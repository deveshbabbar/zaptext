-- Conversation priority + escalation (Work Item 7).
--
-- Adds one column to `conversations`:
--   priority_level varchar(16) NOT NULL DEFAULT 'normal'
--     Values: 'normal' | 'attention' | 'urgent'
--
-- Per-message classification. On each inbound webhook call we run a
-- keyword classifier (English + Hinglish) over the message text and
-- store the result on the row. Outbound rows are always 'normal'.
--
-- Rules surfaced by the dashboard:
--   urgent    -> food poisoning / illness / legal / police / FSSAI
--   attention -> refund / wrong-order / cold-food / late / Zomato-Swiggy
--                 review threat / "speak to manager"
--   normal    -> everything else
--
-- /client/conversations sorts threads with a non-normal last-inbound to
-- the top, with a red (urgent) or amber (attention) dot. The dot is
-- implicitly cleared when the owner sends a reply (next outbound), so
-- we don't need a separate "acknowledged" workflow for v1.
--
-- Existing rows backfill to 'normal' via the DEFAULT clause. No
-- retroactive classification — past conversations weren't classified,
-- and re-running a classifier across history would surface stale
-- complaints the owner has long since handled.

ALTER TABLE conversations
ADD COLUMN priority_level varchar(16) NOT NULL DEFAULT 'normal';
