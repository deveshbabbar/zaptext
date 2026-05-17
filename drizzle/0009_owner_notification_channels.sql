-- Owner notification channels (Default-Prompt Rewrite, owner-configurable).
--
-- Adds three nullable-but-defaulted boolean columns to `clients`:
--   notify_whatsapp   — bot pings the owner on WhatsApp for new orders /
--                       bookings / payment events.
--   notify_email      — same events, but via email (using existing
--                       lib/email.ts sender + onboarding email address).
--   notify_dashboard  — Kanban / Reservations / Conversations get the
--                       same events as in-app rows. Always live; this
--                       flag governs whether the dashboard PUSHES a
--                       browser/sound alert when a new order lands.
--
-- All default TRUE. Existing rows automatically take TRUE via the DEFAULT
-- clause. The Bot Settings page exposes the three as toggles the owner
-- can mute individually (e.g. high-volume restaurants often turn email
-- off because their inbox floods).
--
-- The webhook reads these flags before firing each respective channel.
-- Pre-migration code (which assumes the channels are always on) keeps
-- working because the missing column reads default TRUE in the row mapper.

ALTER TABLE clients
ADD COLUMN notify_whatsapp boolean NOT NULL DEFAULT true,
ADD COLUMN notify_email boolean NOT NULL DEFAULT true,
ADD COLUMN notify_dashboard boolean NOT NULL DEFAULT true;
