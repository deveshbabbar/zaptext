// lib/grocery/substitutions.ts
//
// pickSubstituteFromGroup is pure (testable). findSubstitute is the
// DB-touching wrapper used at runtime.

import { findGroupContaining } from '../db/grocery-substitution-groups';
import { getCatalogForDate } from '../db/grocery-daily-catalog';
import { todayIsoIST } from './date-utils';
import type { CatalogEntry, SubstitutionGroup } from './types';

export function pickSubstituteFromGroup(
  outOfStockProductId: string,
  group: SubstitutionGroup,
  todayCatalog: CatalogEntry[]
): CatalogEntry | null {
  for (const candidateId of group.product_ids) {
    if (candidateId === outOfStockProductId) continue;
    const entry = todayCatalog.find((c) => c.product.id === candidateId);
    if (entry && entry.in_stock) return entry;
  }
  return null;
}

export async function findSubstitute(
  client_id: string,
  outOfStockProductId: string
): Promise<CatalogEntry | null> {
  const group = await findGroupContaining(client_id, outOfStockProductId);
  if (!group) return null;
  const catalog = await getCatalogForDate(client_id, todayIsoIST());
  return pickSubstituteFromGroup(outOfStockProductId, group, catalog);
}
