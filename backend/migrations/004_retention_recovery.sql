BEGIN;
CREATE OR REPLACE FUNCTION axon_security.maintain_validation() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE j record; n integer:=0;
BEGIN
 FOR j IN SELECT request_id,user_id,result FROM axon_security.validation_jobs
 WHERE ((state='processing' AND lease_until<now() AND attempts>=3) OR (state IN ('queued','processing') AND created_at<now()-interval '1 day'))
 ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
  UPDATE axon_security.validation_jobs SET state='failed',delivery_state=CASE WHEN result->>'verdict'='PASS' AND context->'body'->>'mode'='validate_and_dispatch' THEN 'unconfirmed' ELSE 'not_attempted' END,error_code='WORKER_EXHAUSTED',context='{}',completed_at=now(),lease_until=NULL WHERE request_id=j.request_id;
  IF j.result IS NULL THEN PERFORM public.axon_release_validation(j.user_id,j.request_id); END IF;
  n:=n+1;
 END LOOP;
 FOR j IN SELECT request_id,user_id FROM axon_security.validation_inflight WHERE expires_at<now() LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
  IF NOT EXISTS(SELECT 1 FROM public.validation_logs WHERE request_id=j.request_id AND user_id=j.user_id) THEN PERFORM public.axon_release_validation(j.user_id,j.request_id); END IF;
  DELETE FROM axon_security.validation_inflight WHERE request_id=j.request_id;
 END LOOP;
 DELETE FROM public.validation_logs WHERE id IN (
  SELECT l.id FROM public.validation_logs l LEFT JOIN public.axon_account_quota a ON a.user_id=l.user_id
  WHERE l.timestamp<now()-CASE WHEN a.plan IN ('pro','enterprise') THEN interval '30 days' ELSE interval '7 days' END
  ORDER BY l.timestamp LIMIT 1000
 );
 DELETE FROM axon_security.alert_reviews r WHERE NOT EXISTS(SELECT 1 FROM public.validation_logs l WHERE l.id=r.alert_id AND l.user_id=r.user_id);
 DELETE FROM axon_security.rate_windows WHERE window_start<now()-interval '2 days';
 DELETE FROM axon_security.validation_jobs WHERE completed_at<now()-interval '30 days';
 DELETE FROM axon_security.webhook_events WHERE state='completed' AND completed_at<now()-interval '100 days';
 DELETE FROM axon_security.callback_destinations WHERE verified_at IS NULL AND created_at<now()-interval '1 day';
 DELETE FROM axon_security.privacy_requests WHERE state='completed' AND completed_at<now()-interval '100 days';
 RETURN n;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA axon_security FROM PUBLIC;
COMMIT;
