/**
 * AI Assist disambiguation card: "Request unclear" message and suggestion buttons.
 */

import { Component, input, output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-ai-assist-disambiguation',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <div class="ai-assist-result-card mt-4">
      <p class="ai-assist-result-card__goal mb-2">{{ 'AI_ASSIST.REQUEST_UNCLEAR' | translate }}</p>
      <p class="text-sm text-base-content/70 mb-3">{{ 'AI_ASSIST.CHOOSE_DIRECTION' | translate }}</p>
      <div class="ai-assist-result-card__options flex flex-col gap-2">
        @for (s of suggestions(); track s.category) {
          <button
            type="button"
            class="ai-assist-result-card__option btn btn-outline btn-sm justify-start text-left"
            [disabled]="isLoading()"
            (click)="sendClarification.emit(s.text)"
          >
            <span class="ai-assist-result-card__option-icon" aria-hidden="true">›</span>
            <span class="ai-assist-result-card__option-text">{{ s.text }}</span>
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .ai-assist-result-card {
      border-radius: 0.5rem;
      border: 1px solid hsl(var(--b3));
      background: hsl(var(--b2));
      color: hsl(var(--bc));
      padding: 1rem 1.25rem;
      border-left: 4px solid hsl(var(--su));
    }
    .ai-assist-result-card__goal {
      font-size: 1rem;
      font-weight: 600;
      line-height: 1.35;
      color: hsl(var(--bc));
      margin: 0;
    }
    .ai-assist-result-card__options { display: flex; flex-direction: column; gap: 0.5rem; }
    .ai-assist-result-card__option {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 0.75rem;
      width: 100%;
      padding: 0.75rem 1rem;
      min-height: 2.75rem;
      font-size: 0.875rem;
      text-align: left;
      color: hsl(var(--bc));
      background: hsl(var(--b1));
      border: 2px solid hsl(var(--p));
      border-radius: 0.5rem;
      cursor: pointer;
    }
    .ai-assist-result-card__option:hover:not(:disabled) {
      background: hsl(var(--b2));
      border-color: hsl(var(--p) / 0.8);
    }
    .ai-assist-result-card__option-icon {
      flex-shrink: 0;
      width: 1.5rem;
      font-size: 1.25rem;
      font-weight: 700;
      color: hsl(var(--p));
    }
    .ai-assist-result-card__option-text { flex: 1; min-width: 0; white-space: normal; }
    .ai-assist-result-card__option:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
})
export class AiAssistDisambiguationComponent {
  readonly suggestions = input.required<Array<{ text: string; category: string }>>();
  readonly isLoading = input(false);

  readonly sendClarification = output<string>();
}
