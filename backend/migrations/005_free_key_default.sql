-- Reviewed against the owner's 31 October schema output.
-- Changes only future inserts that omit request_limit; existing rows/counters are untouched.
-- Paid-key creation must continue to supply its explicit plan limit.
BEGIN;
ALTER TABLE public.api_keys ALTER COLUMN request_limit SET DEFAULT 100;
COMMIT;
