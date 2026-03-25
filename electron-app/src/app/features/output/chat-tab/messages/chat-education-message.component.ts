import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import type { ChatMessage } from '../../../../core/models/chat.model';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';
import { ChatHighlightChipComponent } from './chat-highlight-chip.component';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-chat-education-message',
  standalone: true,
  imports: [CommonModule, TranslateModule, MarkdownPipe, ChatHighlightChipComponent],
  template: `
    <div class="chat chat-start">
      <div class="chat-header">
        <span class="text-xs opacity-50">AI</span>
      </div>
      <div class="chat-bubble chat-bubble-ghost prose-bubble">
        <div class="text-sm" [innerHTML]="message().content | markdown"></div>

        @if (educationPayload().highlights.length > 0) {
          <div class="mt-3 space-y-2">
            <p class="text-xs font-semibold opacity-70">
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
                class="btn btn-xs btn-outline btn-primary text-left whitespace-normal break-words leading-tight h-auto min-h-[1.5rem] py-1"
                (click)="sendFollowUp.emit(s)"
              >
                {{ s }}
              </button>
            }
          </div>
        }
      </div>
      <div class="chat-footer">
        <button
          class="btn btn-ghost btn-xs opacity-40 hover:opacity-100 gap-1"
          (click)="copyResponse()"
        >
          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </button>
      </div>
    </div>
  `,
  styles: [`
    .chat-bubble-ghost {
      --tw-bg-opacity: 1;
      background-color: hsl(var(--b2) / var(--tw-bg-opacity));
      color: hsl(var(--bc));
    }
    .prose-bubble :host ::ng-deep p { margin: 0.25rem 0; }
    .prose-bubble :host ::ng-deep ul,
    .prose-bubble :host ::ng-deep ol { margin: 0.25rem 0; padding-left: 1.25rem; }
    .prose-bubble :host ::ng-deep li { margin: 0.125rem 0; }
    .prose-bubble :host ::ng-deep code {
      background: hsl(var(--b3));
      padding: 0.125rem 0.25rem;
      border-radius: 0.25rem;
      font-size: 0.8em;
    }
    .prose-bubble :host ::ng-deep pre {
      background: hsl(var(--b3));
      padding: 0.5rem;
      border-radius: 0.375rem;
      overflow-x: auto;
      margin: 0.5rem 0;
    }
    .prose-bubble :host ::ng-deep pre code {
      background: transparent;
      padding: 0;
    }
  `],
})
export class ChatEducationMessageComponent {
  readonly message = input.required<ChatMessage>();
  readonly openDialog = output<string>();
  readonly sendFollowUp = output<string>();
  private readonly toast = inject(ToastService);

  educationPayload() {
    const p = this.message().payload;
    if (p.type === 'education') return p;
    return { highlights: [], followUpSuggestions: [] };
  }

  copyResponse(): void {
    navigator.clipboard.writeText(this.message().content).then(
      () => this.toast.success('Copied to clipboard'),
      () => this.toast.error('Failed to copy')
    );
  }
}
