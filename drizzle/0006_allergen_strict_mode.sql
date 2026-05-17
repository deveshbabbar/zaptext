-- FSSAI allergen-safety guardrail (Work Item 4).
--
-- Adds one boolean column to `clients`:
--   allergen_strict_mode — when TRUE (default), the webhook injects an
--   instruction telling the bot to REFUSE allergen-safety confirmations
--   for menu items with an empty allergens[] list. The bot routes the
--   customer to call the kitchen instead of guessing.
--
-- Rationale: FSSAI 2020 Menu Labelling Regulations make allergen
-- declaration mandatory for chains with 10+ outlets / Central License
-- holders. The bot used to politely defer ("please confirm with kitchen")
-- when fields were blank — fine in spirit, but a soft phrasing can read
-- as "probably safe" to a nut-allergic customer. Strict mode hardens
-- the refusal so a missing field always lands at a human.
--
-- Default TRUE for every bot — opt-out, not opt-in. Owners who have
-- populated allergens[] on every menu item can toggle OFF from
-- /client/settings -> Allergen safety. The downside of a refusal is a
-- friction message to the customer; the downside of a false confirmation
-- is unbounded.
--
-- Existing rows backfill to TRUE automatically via the DEFAULT clause --
-- no separate UPDATE needed.

ALTER TABLE clients
ADD COLUMN allergen_strict_mode boolean NOT NULL DEFAULT true;
