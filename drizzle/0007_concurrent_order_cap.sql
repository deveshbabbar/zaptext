-- Kitchen capacity gate (Work Item 5).
--
-- Adds one nullable integer column to `clients`:
--   concurrent_order_cap — owner-configurable ceiling on the number of
--   in-flight kitchen orders. When live count >= this number, the
--   webhook injects a "kitchen at capacity" instruction and the bot
--   replies with a wait-time quote instead of accepting a new
--   [ORDER:] tag.
--
-- Rationale: today the bot will cheerfully accept "50 dosas in 5 min"
-- because there's no concept of kitchen throughput. Customers get
-- confirmed orders that the kitchen can't possibly deliver on time,
-- the order is late, the customer rage-cancels, and the rating drops
-- on Zomato / Swiggy. Standard SOP at every Indian QSR/dhaba is to
-- pause new orders during the lunch rush -- the bot needs to mirror that.
--
-- "In-flight" definition: status IN ('placed','preparing','ready') AND
-- created_at > now() - interval '15 minutes'. The 15-min window stops
-- stale rows (where status was never transitioned past 'placed')
-- from locking the kitchen permanently.
--
-- NULL = use the platform default (8 concurrent). The webhook clamps
-- the read at [1, 200] so a bug in the settings UI can't push the
-- value to an unreasonable extreme. Single-outlet covers it for v1;
-- per-outlet caps are a Phase 2 migration once outlet-scoping lands
-- on the orders table.

ALTER TABLE clients
ADD COLUMN concurrent_order_cap integer;
