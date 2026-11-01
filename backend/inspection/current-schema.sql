-- Read-only: run in an n8n Postgres Execute Query node.
SELECT p.oid::regprocedure::text AS signature, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE 'axon_%'
ORDER BY p.proname;

SELECT table_name,column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('axon_account_quota','axon_quota_reservation','validation_logs','async_validation_jobs','api_keys')
ORDER BY table_name,ordinal_position;
