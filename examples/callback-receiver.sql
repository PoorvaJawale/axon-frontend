-- Run in the customer's receiving application database, not the Axon DB.
CREATE TABLE axon_callback_receipts(event_id text PRIMARY KEY,payload_hash text NOT NULL,received_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE axon_approved_actions(event_id text PRIMARY KEY REFERENCES axon_callback_receipts(event_id),action jsonb NOT NULL,state text NOT NULL DEFAULT 'pending');
-- Process the outbox with the same event_id as the downstream operation's
-- idempotency key. Never execute an external side effect before this commit.
