-- Adds vertical-specific staff fields as a JSON blob.
-- Lets salon/gym/realestate capture role, certifications, specialisations,
-- per-service upcharge, female-only flag, RERA number etc. without a
-- per-vertical migration. Staff page (UI) strips unknown keys per botType
-- so cross-vertical fields don't leak into the blob.

ALTER TABLE "staff" ADD COLUMN "extra_json" text DEFAULT '{}' NOT NULL;
