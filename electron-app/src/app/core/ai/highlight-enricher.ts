/**
 * Highlight Enricher — Pure function.
 *
 * Transforms raw AI highlight responses (dialogId + relevanceNote)
 * into full SystemHighlight objects by composing:
 * - getCatalogContract() for dialog metadata (family, description)
 * - DialogMenuResolver for menu paths and labels
 */

import type { SystemHighlight } from '../models/chat.model';
import type { DialogMenuResolver } from './dialog-menu-resolver';
import { getCatalogContract } from './dialog-catalog-aggregator';

export function enrichHighlights(
  raw: Array<{ dialogId: string; relevanceNote: string }>,
  menuResolver: DialogMenuResolver
): SystemHighlight[] {
  const results: SystemHighlight[] = [];
  for (const h of raw) {
    const contract = getCatalogContract(h.dialogId);
    if (!contract) continue;

    const menu = menuResolver.resolve(h.dialogId);
    results.push({
      dialogId: h.dialogId,
      dialogLabel: menu?.label ?? contract.description,
      family: contract.family,
      menuPath: menu?.path ?? [],
      relevanceNote: h.relevanceNote,
    });
  }
  return results;
}
