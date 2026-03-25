import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import type { SystemHighlight } from '../../../../core/models/chat.model';

const FAMILY_COLORS: Record<string, string> = {
  inferential: 'badge-primary',
  predictive: 'badge-secondary',
  plotting: 'badge-accent',
  'data-preparation': 'badge-info',
  climatic: 'badge-warning',
};

@Component({
  selector: 'app-chat-highlight-chip',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div
      class="border border-base-300 rounded-lg overflow-hidden cursor-pointer transition-colors hover:bg-base-200/50"
      (click)="expanded.set(!expanded())"
    >
      <div class="flex items-center gap-2 px-3 py-1.5">
        <span class="badge badge-xs" [ngClass]="familyBadgeClass()">
          {{ highlight().family }}
        </span>
        <span class="text-xs font-medium truncate">{{ highlight().dialogLabel }}</span>
        <svg
          class="h-3 w-3 opacity-50 ml-auto transition-transform"
          [class.rotate-180]="expanded()"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      @if (expanded()) {
        <div class="px-3 pb-2 pt-0 space-y-1 border-t border-base-300">
          <p class="text-xs text-base-content/70">{{ highlight().relevanceNote }}</p>
          @if (highlight().menuPath.length > 0) {
            <p class="text-xs text-base-content/50">
              {{ highlight().menuPath.join(' → ') }}
            </p>
          }
          <button
            class="btn btn-xs btn-outline btn-primary mt-1"
            (click)="$event.stopPropagation(); openDialog.emit(highlight().dialogId)"
          >
            {{ 'AI_CHAT.OPEN_DIALOG' | translate }}
          </button>
        </div>
      }
    </div>
  `,
})
export class ChatHighlightChipComponent {
  readonly highlight = input.required<SystemHighlight>();
  readonly openDialog = output<string>();
  readonly expanded = signal(false);

  familyBadgeClass(): string {
    return FAMILY_COLORS[this.highlight().family] ?? 'badge-ghost';
  }
}
