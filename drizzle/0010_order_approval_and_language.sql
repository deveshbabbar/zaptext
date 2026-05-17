-- Order approval mode + default greeting language (owner-configurable).
--
-- order_approval_mode:
--   'auto'   — bot checks stock + capacity, emits [ORDER:] directly.
--              Owner is notified after the fact. Current behaviour.
--   'manual' — bot emits [ORDER_PENDING:], booking goes to
--              pending_approval status, owner gets WhatsApp interactive
--              Approve/Decline buttons. Customer is told to wait. Owner's
--              button click flips status and bot relays the outcome.
--
-- default_language:
--   First-touch / welcome message language. 'english' (default),
--   'hindi', or 'hinglish'. Per-message detection still kicks in on
--   subsequent turns — this is just the cold-start preference.
--
-- Both default at the column level so legacy rows backfill safely.
-- Pre-migration code keeps working because the row mapper falls back
-- to the same defaults when the column is absent.

ALTER TABLE clients
ADD COLUMN order_approval_mode varchar(16) NOT NULL DEFAULT 'auto',
ADD COLUMN default_language varchar(16) NOT NULL DEFAULT 'english';
