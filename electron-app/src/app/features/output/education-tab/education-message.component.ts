/**
 * Education message bubble — presentational component.
 *
 * Renders a single chat message (user or assistant).
 * Assistant messages include markdown-rendered content, highlight chips, and follow-up buttons.
 */

import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import type { EducationMessage } from '../../../core/models/education-chat.model';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';
import { EducationHighlightChipComponent } from './education-highlight-chip.component';

@Component({
  selector: 'app-education-message',
  standalone: true,
  imports: [CommonModule, TranslateModule, MarkdownPipe, EducationHighlightChipComponent],
  template: `
    @if (message().role === 'user') {
      <!-- User message -->
      <div class="flex justify-end">
        <div class="edu-bubble edu-bubble--user">
          <p class="text-sm">{{ message().content }}</p>
        </div>
      </div>
    } @else {
      <!-- Assistant message -->
      <div class="flex justify-start">
        <div class="edu-bubble edu-bubble--assistant">
          <!-- Explanation (markdown rendered) -->
          <div class="edu-explanation text-sm" [innerHTML]="message().content | markdown"></div>

          <!-- Highlight chips -->
          @if (message().highlights?.length) {
            <div class="mt-3 space-y-2">
              <p class="text-xs font-semibold text-base-content/70">
                {{ 'EDUCATION.RELATED_IN_RINSTAT' | translate }}
              </p>
              @for (h of message().highlights!; track h.dialogId) {
                <app-education-highlight-chip
                  [highlight]="h"
                  (openDialog)="openDialog.emit($event)"
                />
              }
            </div>
          }

          <!-- Follow-up suggestions -->
          @if (message().followUpSuggestions?.length) {
            <div class="mt-3 flex flex-wrap gap-1.5">
              @for (s of message().followUpSuggestions!; track s) {
                <button
                  class="btn btn-xs btn-outline btn-primary"
                  (click)="sendFollowUp.emit(s)"
                >
                  {{ s }}
                </button>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .edu-bubble {
      max-width: 85%;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      word-break: break-word;
    }
    .edu-bubble--user {
      background: hsl(var(--p) / 0.15);
      color: hsl(var(--bc));
      border-bottom-right-radius: 0.25rem;
    }
    .edu-bubble--assistant {
      background: hsl(var(--b2));
      color: hsl(var(--bc));
      border: 1px solid hsl(var(--b3));
      border-bottom-left-radius: 0.25rem;
    }
    .edu-explanation :host ::ng-deep p {
      margin: 0.25rem 0;
    }
    .edu-explanation :host ::ng-deep ul,
    .edu-explanation :host ::ng-deep ol {
      margin: 0.25rem 0;
    }
  `],
})
export class EducationMessageComponent {
  readonly message = input.required<EducationMessage>();
  readonly openDialog = output<string>();
  readonly sendFollowUp = output<string>();
}
