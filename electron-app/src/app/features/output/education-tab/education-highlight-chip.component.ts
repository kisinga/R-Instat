/**
 * Expandable highlight chip — presentational component.
 *
 * Shows a compact chip for a SystemHighlight; expands inline (DaisyUI collapse)
 * to reveal relevanceNote, menu breadcrumb, and "Open Dialog" button.
 */

import { Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import type { SystemHighlight } from '../../../core/models/education-chat.model';

@Component({
  selector: 'app-education-highlight-chip',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <div class="collapse collapse-arrow bg-base-200 rounded-lg">
      <input type="checkbox" class="peer" />
      <div class="collapse-title py-2 px-3 min-h-0 text-sm flex items-center gap-2">
        <span class="badge badge-xs" [class]="familyBadgeClass()">{{ highlight().family }}</span>
        <span class="font-medium">{{ highlight().dialogLabel }}</span>
      </div>
      <div class="collapse-content px-3 pb-3 text-sm">
        <p class="text-base-content/80 mb-2">{{ highlight().relevanceNote }}</p>
        @if (highlight().menuPath.length > 0) {
          <p class="text-xs text-base-content/60 mb-2">
            {{ 'EDUCATION.NAVIGATE_TO' | translate }}:
            {{ highlight().menuPath.join(' > ') }}
          </p>
        }
        <button
          class="btn btn-xs btn-primary"
          (click)="openDialog.emit(highlight().dialogId)"
        >
          {{ 'EDUCATION.OPEN_DIALOG' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .collapse-title {
      font-size: 0.8125rem;
    }
  `],
})
export class EducationHighlightChipComponent {
  readonly highlight = input.required<SystemHighlight>();
  readonly openDialog = output<string>();

  protected familyBadgeClass(): string {
    switch (this.highlight().family) {
      case 'inferential': return 'badge-primary';
      case 'predictive': return 'badge-secondary';
      case 'plotting': return 'badge-accent';
      case 'data-preparation': return 'badge-info';
      case 'climatic': return 'badge-warning';
      default: return 'badge-ghost';
    }
  }
}
