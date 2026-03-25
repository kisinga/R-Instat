import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import type { ChatMessage } from '../../../../core/models/chat.model';

@Component({
  selector: 'app-chat-disambiguation-message',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="chat chat-start">
      <div class="chat-header">
        <span class="text-xs opacity-50">AI</span>
      </div>
      <div class="chat-bubble chat-bubble-warning text-sm">
        <p class="mb-2">{{ message().content }}</p>
        <div class="space-y-1.5">
          @for (s of suggestions(); track s.text) {
            <button
              class="btn btn-sm btn-outline btn-block justify-start text-left text-xs whitespace-normal break-words leading-tight h-auto min-h-[2rem] py-1.5"
              (click)="sendClarification.emit(s.text)"
            >
              {{ s.text }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class ChatDisambiguationMessageComponent {
  readonly message = input.required<ChatMessage>();
  readonly sendClarification = output<string>();

  suggestions() {
    const p = this.message().payload;
    return p.type === 'disambiguation' ? p.suggestions : [];
  }
}
