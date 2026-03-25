/**
 * Highlight Enricher Service.
 *
 * Wraps the pure enrichHighlights function with its DialogMenuResolver
 * dependency, so consumers don't need to construct the resolver themselves.
 */

import { Injectable, inject } from '@angular/core';
import { LanguageService } from './language.service';
import { enrichHighlights } from '../ai/highlight-enricher';
import { DialogMenuResolver, STANDARD_MENU_GROUPS } from '../ai/dialog-menu-resolver';
import type { SystemHighlight } from '../models/chat.model';

@Injectable({ providedIn: 'root' })
export class HighlightEnricherService {
  private readonly languageService = inject(LanguageService);

  enrich(rawHighlights: Array<{ dialogId: string; relevanceNote: string }>): SystemHighlight[] {
    const resolver = new DialogMenuResolver(
      STANDARD_MENU_GROUPS,
      (key: string) => this.languageService.instant(key)
    );
    return enrichHighlights(rawHighlights, resolver);
  }
}
