-- Admin-run staging template. NOLOGIN group roles: provision separate login secrets
-- in your provider, then grant only the appropriate group. Never use a DB owner in Vercel.
BEGIN;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='axon_web') THEN CREATE ROLE axon_web NOLOGIN; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='axon_validator') THEN CREATE ROLE axon_validator NOLOGIN; END IF; END $$;
GRANT USAGE ON SCHEMA public,axon_security TO axon_web,axon_validator;
REVOKE EXECUTE ON FUNCTION public.axon_apply_billing(text,text,timestamptz,timestamptz,timestamptz,bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.axon_reserve_validation(text,text,boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.axon_release_validation(text,text) FROM PUBLIC;
GRANT SELECT,INSERT ON public.api_keys TO axon_web;
GRANT UPDATE(is_active,plan,request_limit,updated_at) ON public.api_keys TO axon_web;
GRANT SELECT,INSERT ON public.axon_account_quota TO axon_web;
GRANT UPDATE(plan,paid_used,period_start,period_end,custom_limit,billing_event_at) ON public.axon_account_quota TO axon_web;
GRANT SELECT ON public.validation_logs TO axon_web;
GRANT SELECT,INSERT,UPDATE ON axon_security.rate_windows,axon_security.alert_reviews,axon_security.webhook_events,axon_security.privacy_requests TO axon_web;
GRANT SELECT,INSERT,UPDATE,DELETE ON axon_security.checkout_operations,axon_security.callback_destinations TO axon_web;
GRANT EXECUTE ON FUNCTION axon_security.take_rate_limit(text,integer,integer),public.axon_apply_billing(text,text,timestamptz,timestamptz,timestamptz,bigint) TO axon_web;
GRANT SELECT ON public.api_keys,public.axon_account_quota,axon_security.callback_destinations TO axon_validator;
GRANT UPDATE(last_used_at) ON public.api_keys TO axon_validator;
GRANT UPDATE(free_used,paid_used) ON public.axon_account_quota TO axon_validator;
GRANT SELECT,INSERT,UPDATE ON public.axon_quota_reservation TO axon_validator;
GRANT SELECT,INSERT,DELETE ON public.validation_logs TO axon_validator;
GRANT SELECT,INSERT,UPDATE,DELETE ON axon_security.validation_jobs,axon_security.validation_inflight,axon_security.rate_windows TO axon_validator;
GRANT SELECT,DELETE ON axon_security.alert_reviews,axon_security.webhook_events,axon_security.privacy_requests TO axon_validator;
GRANT DELETE ON axon_security.callback_destinations TO axon_validator;
GRANT EXECUTE ON FUNCTION public.axon_reserve_validation(text,text,boolean),public.axon_release_validation(text,text),axon_security.take_rate_limit(text,integer,integer),axon_security.reserve_validation(text,text,jsonb,text),axon_security.claim_validation(),axon_security.save_judge(text,integer,jsonb),axon_security.finish_job(text,integer,text),axon_security.finish_sync(text,text,boolean),axon_security.maintain_validation() TO axon_validator;
-- Identity/serial sequence grants, discovered rather than assuming generated sequence names.
DO $$ DECLARE s text; BEGIN
 s:=pg_get_serial_sequence('public.api_keys','id');IF s IS NOT NULL THEN EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE %s TO axon_web',s);END IF;
 s:=pg_get_serial_sequence('public.validation_logs','id');IF s IS NOT NULL THEN EXECUTE format('GRANT USAGE,SELECT ON SEQUENCE %s TO axon_validator',s);END IF;
END $$;
COMMIT;
