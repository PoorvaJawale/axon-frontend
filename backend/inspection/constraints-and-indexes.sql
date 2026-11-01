-- Read-only. One JSON result avoids n8n table pagination.
WITH target AS (
 SELECT c.oid, n.nspname, c.relname
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN
 ('api_keys','axon_account_quota','axon_quota_reservation','validation_logs','async_validation_jobs')
 AND c.relkind IN ('r','p')
)
SELECT jsonb_build_object(
 'constraints', COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'table',t.relname,'name',c.conname,'definition',pg_get_constraintdef(c.oid)))
   FROM target t JOIN pg_constraint c ON c.conrelid=t.oid),'[]'::jsonb),
 'indexes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'table',t.relname,'definition',pg_get_indexdef(i.indexrelid)))
   FROM target t JOIN pg_index i ON i.indrelid=t.oid),'[]'::jsonb),
 'triggers', COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'table',t.relname,'name',g.tgname,'definition',pg_get_triggerdef(g.oid)))
   FROM target t JOIN pg_trigger g ON g.tgrelid=t.oid WHERE NOT g.tgisinternal),'[]'::jsonb),
 'row_security', COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'table',t.relname,'enabled',c.relrowsecurity,'forced',c.relforcerowsecurity))
   FROM target t JOIN pg_class c ON c.oid=t.oid),'[]'::jsonb)
) AS schema_details;
