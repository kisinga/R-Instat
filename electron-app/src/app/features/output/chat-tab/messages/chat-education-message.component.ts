import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import type { ChatMessage } from '../../../../core/models/chat.model';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';
import { ChatHighlightChipComponent } from './chat-highlight-chip.component';

@Component({
  selector: 'app-chat-education-message',
  standalone: true,
  imports: [CommonModule, TranslateModule, MarkdownPipe, ChatHighlightChipComponent],
  template: `
    <div class="flex justify-start">
      <div class="chat-bubble chat-bubble--assistant">
        <div class="text-sm prose-sm" [innerHTML]="message().content | markdown"></div>

        @if (educationPayload().highlights.length > 0) {
          <div class="mt-3 space-y-2">
            <p class="text-xs font-semibold text-base-content/70">
              {{ 'AI_CHAT.RELATED_IN_RINSTAT' | translate }}
            </p>
            @for (h of educationPayload().highlights; track h.dialogId) {
              <app-chat-highlight-chip
                [highlight]="h"
                (openDialog)="openDialog.emit($event)"
              />
            }
          </div>
        }

        @if (educationPayload().followUpSuggestions.length > 0) {
          <div class="mt-3 flex flex-wrap gap-1.5">
            @for (s of educationPayload().followUpSuggestions; track s) {
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
  `,
  styles: [`
    .chat-bubble {
      max-width: 85%;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      word-break: break-word;
    }
    .chat-bubble--assistant {
      background: hsl(var(--b2));
      color: hsl(var(--bc));
      border: 1px solid hsl(var(--b3));
      border-bottom-left-radius: 0.25rem;
    }
  `],
})
export class ChatEducationMessageComponent {
  readonly message = input.required<ChatMessage>();
  readonly openDialog = output<string>();
  readonly sendFollowUp = output<string>();

  educationPayload() {
    const p = this.message().payload;
    if (p.type === 'education') return p;
    return { highlights: [], followUpSuggestions: [] };
  }
}
