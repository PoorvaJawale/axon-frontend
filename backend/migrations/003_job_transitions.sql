-- Safe job transitions; attempts act as fencing tokens against expired workers.
BEGIN;
CREATE OR REPLACE FUNCTION axon_security.save_judge(p_id text,p_attempt integer,p_judge jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE j axon_security.validation_jobs%ROWTYPE;
BEGIN
 SELECT * INTO j FROM axon_security.validation_jobs WHERE request_id=p_id FOR UPDATE;
 IF NOT FOUND OR j.state<>'processing' OR j.attempts<>p_attempt OR j.lease_until<now() THEN RETURN NULL; END IF;
 IF j.result IS NULL THEN
  IF p_judge->>'verdict' NOT IN ('PASS','BLOCK') THEN RAISE EXCEPTION 'Invalid verdict'; END IF;
  UPDATE axon_security.validation_jobs SET result=p_judge WHERE request_id=p_id;
  INSERT INTO public.validation_logs(user_id,agent_id,request_id,action_type,schema_result,semantic_result,final_verdict,reason,raw_output)
  VALUES(j.user_id,j.context->'body'->>'agent_id',j.request_id,j.context->'body'->>'action_type','PASSED',p_judge->>'verdict',p_judge->>'verdict',(p_judge->>'category')||' / '||(p_judge->>'risk')||' / '||(p_judge->>'verdict'),'{}'::jsonb);
 END IF;
 RETURN j.context||jsonb_build_object('attempt',j.attempts,'judge',COALESCE(j.result,p_judge));
END $$;
CREATE OR REPLACE FUNCTION axon_security.finish_job(p_id text,p_attempt integer,p_error text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE j axon_security.validation_jobs%ROWTYPE;
BEGIN
 SELECT * INTO j FROM axon_security.validation_jobs WHERE request_id=p_id FOR UPDATE;
 IF NOT FOUND OR j.state<>'processing' OR j.attempts<>p_attempt THEN RETURN false; END IF;
 UPDATE axon_security.validation_jobs SET delivery_state=CASE
  WHEN j.result IS NULL OR j.result->>'verdict'='BLOCK' THEN 'not_attempted'
  WHEN j.context->'body'->>'mode'='validate_only' THEN 'not_requested'
  WHEN p_error IS NULL THEN 'delivered' ELSE 'unconfirmed' END WHERE request_id=p_id;
 IF p_error IS NOT NULL AND j.attempts<3 THEN
  UPDATE axon_security.validation_jobs SET state='queued',next_at=now()+make_interval(secs=>30*j.attempts),error_code=left(p_error,80),lease_until=NULL WHERE request_id=p_id;
 ELSE
  UPDATE axon_security.validation_jobs SET state=CASE WHEN p_error IS NULL THEN 'completed' ELSE 'failed' END,error_code=left(p_error,80),context='{}',completed_at=now(),lease_until=NULL WHERE request_id=p_id;
  IF j.result IS NULL THEN PERFORM public.axon_release_validation(j.user_id,j.request_id); END IF;
 END IF;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION axon_security.finish_sync(p_user text,p_id text,p_internal_error boolean) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
 IF p_internal_error THEN PERFORM public.axon_release_validation(p_user,p_id); END IF;
 DELETE FROM axon_security.validation_inflight WHERE user_id=p_user AND request_id=p_id;
 RETURN true;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA axon_security FROM PUBLIC;
COMMIT;
