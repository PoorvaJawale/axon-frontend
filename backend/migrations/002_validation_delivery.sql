-- Deploy only after staging verification; preserves existing quota counters/functions.
BEGIN;
CREATE TABLE IF NOT EXISTS axon_security.callback_destinations (
 user_id text NOT NULL, url text NOT NULL, challenge_hash text NOT NULL,
 signing_secret text NOT NULL, verified_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,url)
);
CREATE TABLE IF NOT EXISTS axon_security.validation_jobs (
 request_id text PRIMARY KEY, user_id text NOT NULL, key_id bigint NOT NULL,
 context jsonb NOT NULL, state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','completed','failed')),
 attempts integer NOT NULL DEFAULT 0, next_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz, result jsonb, error_code text, delivery_state text NOT NULL DEFAULT 'pending' CHECK(delivery_state IN ('pending','not_requested','not_attempted','delivered','unconfirmed')),
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS validation_job_ready ON axon_security.validation_jobs(next_at,created_at) WHERE state IN ('queued','processing');
ALTER TABLE public.validation_logs ADD COLUMN IF NOT EXISTS agent_id text;
ALTER TABLE public.validation_logs ADD COLUMN IF NOT EXISTS request_id text;
CREATE UNIQUE INDEX IF NOT EXISTS axon_log_request ON public.validation_logs(request_id) WHERE request_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS axon_security.validation_inflight(request_id text PRIMARY KEY,user_id text NOT NULL,expires_at timestamptz NOT NULL DEFAULT now()+interval '2 minutes');
CREATE INDEX IF NOT EXISTS axon_logs_tenant_time ON public.validation_logs(user_id,timestamp DESC,id DESC);
CREATE OR REPLACE FUNCTION axon_security.reserve_validation(p_hash text,p_request_id text,p_body jsonb,p_route text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE k record; a public.axon_account_quota%ROWTYPE; r jsonb; n integer;
BEGIN
 IF NOT axon_security.take_rate_limit(md5('ingress')||md5('ingress'),1000,60) THEN RETURN jsonb_build_object('authenticated',false,'quota_allowed',false,'http_status',429,'reason','Request rate exceeded'); END IF;
 SELECT id,user_id INTO k FROM public.api_keys WHERE hashed_api_key=p_hash AND is_active AND expires_at>now();
 IF NOT FOUND THEN RETURN jsonb_build_object('authenticated',false,'quota_allowed',false,'http_status',401); END IF;
 -- Match the quota function's account lock. Limits span every key on the account.
 SELECT * INTO a FROM public.axon_account_quota WHERE user_id=k.user_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('authenticated',true,'quota_allowed',false,'http_status',503,'reason','Account quota has not been initialized'); END IF;
 IF a.plan IS NULL OR a.plan NOT IN ('free','pro','enterprise') OR a.free_used IS NULL OR a.paid_used IS NULL OR a.free_used<0 OR a.paid_used<0 OR (a.plan='enterprise' AND (a.custom_limit IS NULL OR a.custom_limit<=0)) THEN RETURN jsonb_build_object('authenticated',true,'quota_allowed',false,'http_status',503,'reason','Account quota needs support review'); END IF;
 IF NOT axon_security.take_rate_limit(md5('validation:'||k.user_id)||md5('validation:'||k.user_id),60,60) THEN
  RETURN jsonb_build_object('authenticated',true,'quota_allowed',false,'http_status',429,'reason','Request rate exceeded'); END IF;
 IF p_route NOT IN ('sync','async','skip') OR p_body->>'mode' NOT IN ('validate_only','validate_and_dispatch') THEN RAISE EXCEPTION 'Invalid validation policy'; END IF;
 IF p_body->>'mode'='validate_and_dispatch' AND NOT EXISTS(SELECT 1 FROM axon_security.callback_destinations WHERE user_id=k.user_id AND url=p_body->>'execution_endpoint' AND verified_at IS NOT NULL) THEN
  RETURN jsonb_build_object('authenticated',true,'quota_allowed',false,'http_status',403,'reason','Verify this callback destination before dispatching'); END IF;
 SELECT count(*) INTO n FROM axon_security.validation_jobs WHERE user_id=k.user_id AND state IN ('queued','processing');
 IF n>=10 THEN RETURN jsonb_build_object('authenticated',true,'quota_allowed',false,'http_status',429,'reason','Too many pending validations'); END IF;
 -- Global admission ceiling bounds model calls even when many Free accounts sign up.
 IF p_route<>'skip' AND NOT axon_security.take_rate_limit(md5('global-model')||md5('global-model'),10000,86400) THEN
  RETURN jsonb_build_object('authenticated',true,'quota_allowed',false,'http_status',503,'reason','Validation capacity temporarily unavailable'); END IF;
 IF p_route='sync' THEN
  PERFORM pg_advisory_xact_lock(71387014);
  IF (SELECT count(*) FROM axon_security.validation_inflight WHERE expires_at>now())>=4 OR (SELECT count(*) FROM axon_security.validation_inflight WHERE user_id=k.user_id AND expires_at>now())>=2 THEN
   RETURN jsonb_build_object('authenticated',true,'quota_allowed',false,'http_status',429,'reason','Concurrent validation capacity exceeded');
  END IF;
 END IF;
 r:=public.axon_reserve_validation(p_hash,p_request_id,p_route='skip');
 IF COALESCE((r->>'quota_allowed')::boolean,false) AND p_route='sync' THEN
  INSERT INTO axon_security.validation_inflight(request_id,user_id) VALUES(p_request_id,k.user_id);
 END IF;
 IF COALESCE((r->>'quota_allowed')::boolean,false) AND p_route='async' THEN
  INSERT INTO axon_security.validation_jobs(request_id,user_id,key_id,context)
  VALUES(p_request_id,k.user_id,k.id,jsonb_build_object('body',p_body,'request_id',p_request_id,'reservation_id',p_request_id,'user_id',k.user_id,'key_id',k.id));
 END IF;
 IF p_body->>'mode'='validate_and_dispatch' THEN
  r:=r||jsonb_build_object('webhook_secret',(SELECT signing_secret FROM axon_security.callback_destinations WHERE user_id=k.user_id AND url=p_body->>'execution_endpoint' AND verified_at IS NOT NULL));
 END IF;
 RETURN r||jsonb_build_object('callback_verified',p_body->>'mode'='validate_and_dispatch');
END $$;
CREATE OR REPLACE FUNCTION axon_security.claim_validation() RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE j record;
BEGIN
 -- A small global worker cap. The lock is held only for this short claim transaction.
 PERFORM pg_advisory_xact_lock(71387013);
 IF (SELECT count(*) FROM axon_security.validation_jobs WHERE state='processing' AND lease_until>now())>=4 THEN RETURN NULL; END IF;
 SELECT * INTO j FROM axon_security.validation_jobs
 WHERE ((state='queued' AND next_at<=now()) OR (state='processing' AND lease_until<now())) AND attempts<3 AND NOT EXISTS(SELECT 1 FROM axon_security.validation_jobs active WHERE active.user_id=axon_security.validation_jobs.user_id AND active.state='processing' AND active.lease_until>now())
 ORDER BY next_at,created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.api_keys WHERE id=j.key_id AND user_id=j.user_id AND is_active AND expires_at>now()) THEN
  UPDATE axon_security.validation_jobs SET state='failed',delivery_state=CASE WHEN result->>'verdict'='PASS' AND context->'body'->>'mode'='validate_and_dispatch' THEN 'unconfirmed' ELSE 'not_attempted' END,context='{}',error_code='KEY_REVOKED',completed_at=now() WHERE request_id=j.request_id;
  IF j.result IS NULL THEN PERFORM public.axon_release_validation(j.user_id,j.request_id); END IF;
  RETURN NULL;
 END IF;
 UPDATE axon_security.validation_jobs SET state='processing',attempts=attempts+1,lease_until=now()+interval '2 minutes' WHERE request_id=j.request_id;
 RETURN j.context||jsonb_build_object('attempt',j.attempts+1,'cached_judge',j.result);
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA axon_security FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA axon_security FROM PUBLIC;
COMMIT;
