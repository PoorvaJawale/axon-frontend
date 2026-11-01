-- TEST FIXTURE ONLY: reconstructed from owner-supplied column/constraint/index metadata.
-- Not a production migration or a backup. Contains no account records.
CREATE SEQUENCE public."api_keys_id_seq";
CREATE SEQUENCE public."async_validation_jobs_id_seq";
CREATE SEQUENCE public."validation_logs_id_seq";
CREATE TABLE public."api_keys" (
 "id" bigint NOT NULL DEFAULT nextval('api_keys_id_seq'::regclass),
 "user_id" text NOT NULL,
 "email" text,
 "user_name" text,
 "name" text,
 "key_prefix" text,
 "hashed_api_key" text NOT NULL,
 "webhook_secret" text,
 "plan" text NOT NULL DEFAULT 'free'::text,
 "request_limit" integer NOT NULL DEFAULT 1000,
 "monthly_requests" integer NOT NULL DEFAULT 0,
 "is_active" boolean NOT NULL DEFAULT true,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
 "last_used_at" timestamp with time zone,
 "expires_at" timestamp with time zone NOT NULL DEFAULT (now() + '90 days'::interval)
);
CREATE TABLE public."async_validation_jobs" (
 "id" bigint NOT NULL DEFAULT nextval('async_validation_jobs_id_seq'::regclass),
 "request_id" text NOT NULL,
 "status" text NOT NULL DEFAULT 'PENDING'::text,
 "created_at" timestamp with time zone NOT NULL DEFAULT now(),
 "completed_at" timestamp with time zone,
 "result" jsonb
);
CREATE TABLE public."axon_account_quota" (
 "user_id" text NOT NULL,
 "plan" text NOT NULL DEFAULT 'free'::text,
 "free_used" bigint NOT NULL DEFAULT 0,
 "paid_used" bigint NOT NULL DEFAULT 0,
 "period_start" timestamp with time zone,
 "period_end" timestamp with time zone,
 "custom_limit" bigint NOT NULL DEFAULT 0,
 "billing_event_at" timestamp with time zone NOT NULL DEFAULT '1970-01-01 00:00:00+00'::timestamp with time zone
);
CREATE TABLE public."axon_quota_reservation" (
 "request_id" text NOT NULL,
 "user_id" text NOT NULL,
 "bucket" text NOT NULL,
 "period_start" timestamp with time zone,
 "released" boolean NOT NULL DEFAULT false,
 "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE public."validation_logs" (
 "id" bigint NOT NULL DEFAULT nextval('validation_logs_id_seq'::regclass),
 "timestamp" timestamp with time zone NOT NULL DEFAULT now(),
 "user_id" text,
 "action_type" text,
 "schema_result" text,
 "semantic_result" text,
 "final_verdict" text,
 "verdict" text,
 "risk_level" text,
 "confidence" numeric,
 "category" text,
 "reason" text,
 "raw_output" text
);
ALTER SEQUENCE public."api_keys_id_seq" OWNED BY public."api_keys"."id";
ALTER SEQUENCE public."async_validation_jobs_id_seq" OWNED BY public."async_validation_jobs"."id";
ALTER SEQUENCE public."validation_logs_id_seq" OWNED BY public."validation_logs"."id";
ALTER TABLE public."api_keys" ADD CONSTRAINT "api_keys_pkey" PRIMARY KEY (id);
ALTER TABLE public."api_keys" ADD CONSTRAINT "api_keys_hashed_api_key_key" UNIQUE (hashed_api_key);
ALTER TABLE public."validation_logs" ADD CONSTRAINT "validation_logs_pkey" PRIMARY KEY (id);
ALTER TABLE public."async_validation_jobs" ADD CONSTRAINT "async_validation_jobs_pkey" PRIMARY KEY (id);
ALTER TABLE public."async_validation_jobs" ADD CONSTRAINT "async_validation_jobs_request_id_key" UNIQUE (request_id);
ALTER TABLE public."axon_account_quota" ADD CONSTRAINT "axon_account_quota_plan_check" CHECK ((plan = ANY (ARRAY['free'::text, 'pro'::text, 'enterprise'::text])));
ALTER TABLE public."axon_account_quota" ADD CONSTRAINT "axon_account_quota_free_used_check" CHECK ((free_used >= 0));
ALTER TABLE public."axon_account_quota" ADD CONSTRAINT "axon_account_quota_paid_used_check" CHECK ((paid_used >= 0));
ALTER TABLE public."axon_account_quota" ADD CONSTRAINT "axon_account_quota_custom_limit_check" CHECK ((custom_limit >= 0));
ALTER TABLE public."axon_account_quota" ADD CONSTRAINT "axon_account_quota_check" CHECK ((((period_start IS NULL) AND (period_end IS NULL)) OR ((period_start IS NOT NULL) AND (period_end IS NOT NULL) AND (period_end > period_start))));
ALTER TABLE public."axon_account_quota" ADD CONSTRAINT "axon_account_quota_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."axon_quota_reservation" ADD CONSTRAINT "axon_quota_reservation_bucket_check" CHECK ((bucket = ANY (ARRAY['free'::text, 'paid'::text])));
ALTER TABLE public."axon_quota_reservation" ADD CONSTRAINT "axon_quota_reservation_pkey" PRIMARY KEY (request_id);
ALTER TABLE public."axon_quota_reservation" ADD CONSTRAINT "axon_quota_reservation_user_id_fkey" FOREIGN KEY (user_id) REFERENCES axon_account_quota(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_pkey ON public.api_keys USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hashed_api_key_key ON public.api_keys USING btree (hashed_api_key);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hashed ON public.api_keys USING btree (hashed_api_key);
CREATE UNIQUE INDEX IF NOT EXISTS validation_logs_pkey ON public.validation_logs USING btree (id);
CREATE INDEX IF NOT EXISTS idx_logs_user_time ON public.validation_logs USING btree (user_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_logs_blocked ON public.validation_logs USING btree (user_id) WHERE (final_verdict = 'BLOCK'::text);
CREATE UNIQUE INDEX IF NOT EXISTS async_validation_jobs_pkey ON public.async_validation_jobs USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS async_validation_jobs_request_id_key ON public.async_validation_jobs USING btree (request_id);
CREATE UNIQUE INDEX IF NOT EXISTS axon_account_quota_pkey ON public.axon_account_quota USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS axon_quota_reservation_pkey ON public.axon_quota_reservation USING btree (request_id);
CREATE INDEX IF NOT EXISTS axon_quota_reservation_user_id_idx ON public.axon_quota_reservation USING btree (user_id);
