// Shared display of the active bot's selected sub-types. Reads from the
// flat `subTypes: string[]` array on knowledge_base_json (falls back to
// the legacy single `subType` field for pre-migration bots). Renders a
// muted chip row beneath the page header so the owner sees what business
// configuration their bot is currently running with.
//
// Used by all 8 vertical overview pages (restaurant, coaching, realestate,
// salon, gym, tiffin, ecommerce, grocery). Empty array → nothing renders.

interface Props {
  /** Parsed knowledge_base_json object */
  kb: Record<string, unknown>;
}

function humanize(slug: string): string {
  return slug
    .split(/[-_]/g)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function SubTypesChips({ kb }: Props) {
  const list: string[] = Array.isArray(kb.subTypes)
    ? (kb.subTypes as unknown[]).filter((s): s is string => typeof s === 'string' && s.length > 0)
    : typeof kb.subType === 'string' && kb.subType.length > 0
      ? [kb.subType]
      : [];

  if (list.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-5 -mt-3">
      <span className="text-[10.5px] uppercase tracking-[.08em] text-[var(--mute)] font-semibold mr-1">
        Sub-types:
      </span>
      {list.map((s) => (
        <span
          key={s}
          className="text-[11.5px] rounded-full border border-[var(--line)] bg-[var(--card)]"
          style={{ padding: '3px 10px' }}
        >
          {humanize(s)}
        </span>
      ))}
    </div>
  );
}
