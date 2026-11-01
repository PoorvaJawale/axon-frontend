-- Additive control-plane migration. Run in staging after backup and schema preflight.
BEGIN;
CREATE SCHEMA IF NOT EXISTS axon_security;
REVOKE ALL ON SCHEMA axon_security FROM PUBLIC;
CREATE TABLE IF NOT EXISTS axon_security.rate_windows (bucket text PRIMARY KEY, window_start timestamptz NOT NULL, hits integer NOT NULL CHECK (hits > 0));
CREATE TABLE IF NOT EXISTS axon_security.checkout_operations (user_id text PRIMARY KEY, operation_id uuid NOT NULL DEFAULT gen_random_uuid(), state text NOT NULL CHECK (state IN ('pending','ready','ambiguous')), subscription_id text, plan_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS axon_security.webhook_events (event_id text PRIMARY KEY, body_hash text NOT NULL, state text NOT NULL CHECK (state IN ('processing','completed')), lease_until timestamptz NOT NULL, completed_at timestamptz);
CREATE TABLE IF NOT EXISTS axon_security.alert_reviews (user_id text NOT NULL, alert_id bigint NOT NULL, reviewed boolean NOT NULL, reviewed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,alert_id));
CREATE TABLE IF NOT EXISTS axon_security.privacy_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('export','delete')), state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','completed','failed')), created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, started_at timestamptz);
CREATE UNIQUE INDEX IF NOT EXISTS privacy_pending_request ON axon_security.privacy_requests(user_id,kind) WHERE state IN ('pending','processing');
CREATE OR REPLACE FUNCTION axon_security.take_rate_limit(p_bucket text,p_max integer,p_seconds integer) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
 IF p_max < 1 OR p_seconds < 1 OR p_seconds > 86400 OR length(p_bucket) <> 64 THEN RAISE EXCEPTION 'Invalid rate policy'; END IF;
 INSERT INTO axon_security.rate_windows(bucket,window_start,hits) VALUES(p_bucket,clock_timestamp(),1)
 ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN axon_security.rate_windows.window_start <= clock_timestamp()-make_interval(secs=>p_seconds) THEN 1 ELSE axon_security.rate_windows.hits+1 END,
 window_start=CASE WHEN axon_security.rate_windows.window_start <= clock_timestamp()-make_interval(secs=>p_seconds) THEN clock_timestamp() ELSE axon_security.rate_windows.window_start END RETURNING hits INTO n;
 RETURN n <= p_max;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA axon_security FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA axon_security FROM PUBLIC;
-- Use a dedicated server role; grant only required schema/table/function privileges during deployment.
COMMIT;
