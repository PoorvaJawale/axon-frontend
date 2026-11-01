-- Reviewed operator template; never run against a real account without a verified
-- deletion request, provider cancellation check, backup policy and stopped/drained work.
-- All $1 values must be bound to the user_id from the authenticated privacy request.
BEGIN;
SELECT 1 FROM public.axon_account_quota WHERE user_id=$1 FOR UPDATE;
UPDATE public.api_keys SET is_active=false,updated_at=now() WHERE user_id=$1;
-- Commit revocation and stop new key provisioning for a processing deletion request,
-- then allow the 120-second workflow deadline plus a safety buffer before deletion.
ROLLBACK; -- Intentional: this file is an operator review template, not an auto-delete migration.
-- Required deletion order after drain: validation_jobs, alert_reviews,
-- callback_destinations, validation_logs, quota_reservations, api_keys,
-- account_quota. Reconcile checkout/billing records under the applicable retention policy.
-- Delete Clerk identity separately; verify provider/support/backups handling;
-- mark the authenticated request completed only after verifying the full scope.
