import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import type { ChatMessage } from '../../../../core/models/chat.model';

@Component({
  selector: 'app-chat-disambiguation-message',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="flex justify-start">
      <div class="chat-bubble chat-bubble--disambiguation">
        <p class="text-sm mb-2">{{ message().content }}</p>
        <div class="space-y-1.5">
          @for (s of suggestions(); track s.text) {
            <button
              class="btn btn-sm btn-outline btn-block justify-start text-left text-xs"
              (click)="sendClarification.emit(s.text)"
            >
              {{ s.text }}
            </button>
          }
        </div>
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
    .chat-bubble--disambiguation {
      background: hsl(var(--b2));
      color: hsl(var(--bc));
      border: 1px solid hsl(var(--wa) / 0.3);
      border-bottom-left-radius: 0.25rem;
    }
  `],
})
export class ChatDisambiguationMessageComponent {
  readonly message = input.required<ChatMessage>();
  readonly sendClarification = output<string>();

  suggestions() {
    const p = this.message().payload;
    return p.type === 'disambiguation' ? p.suggestions : [];
  }
}
