import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import type { ChatMessage } from '../../../../core/models/chat.model';

const MAX_VISIBLE_OPTIONS = 3;

@Component({
  selector: 'app-chat-disambiguation-message',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="chat chat-start">
      <div class="chat-header">
        <span class="text-xs opacity-50">AI</span>
      </div>
      <div class="chat-bubble chat-bubble-warning text-sm">
        <p class="mb-2">{{ message().content }}</p>
        <div class="space-y-1.5">
          @for (s of visibleSuggestions(); track s.text) {
            <button
              class="btn btn-sm btn-outline btn-block justify-start text-left text-xs whitespace-normal break-words leading-tight h-auto min-h-[2rem] py-1.5"
              (click)="sendClarification.emit(s.text)"
            >
              {{ s.text }}
            </button>
          }
          @if (suggestions().length > maxVisible) {
            <button
              class="btn btn-xs btn-ghost btn-block opacity-60"
              (click)="showAll.set(!showAll())"
            >
              {{ showAll() ? ('AI_CHAT.SHOW_LESS' | translate) : ('AI_CHAT.SHOW_MORE' | translate : { count: suggestions().length - maxVisible }) }}
            </button>
          }
        </div>

        <!-- Custom response input -->
        <div class="mt-2 flex gap-1.5">
          <input
            type="text"
            class="input input-xs input-bordered flex-1 text-xs"
            [placeholder]="'AI_CHAT.CUSTOM_RESPONSE_PLACEHOLDER' | translate"
            [ngModel]="customInput()"
            (ngModelChange)="customInput.set($event)"
            (keydown.enter)="sendCustom()"
          />
          <button
            class="btn btn-xs btn-primary"
            [disabled]="!customInput().trim()"
            (click)="sendCustom()"
          >
            {{ 'AI_CHAT.SEND' | translate }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ChatDisambiguationMessageComponent {
  readonly message = input.required<ChatMessage>();
  readonly sendClarification = output<string>();

  readonly customInput = signal('');
  readonly showAll = signal(false);
  readonly maxVisible = MAX_VISIBLE_OPTIONS;

  suggestions() {
    const p = this.message().payload;
    return p.type === 'disambiguation' ? p.suggestions : [];
  }

  visibleSuggestions() {
    const all = this.suggestions();
    return this.showAll() ? all : all.slice(0, MAX_VISIBLE_OPTIONS);
  }

  sendCustom(): void {
    const text = this.customInput().trim();
    if (!text) return;
    this.customInput.set('');
    this.sendClarification.emit(text);
  }
}
