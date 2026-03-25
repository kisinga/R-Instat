import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ChatMessage } from '../../../../core/models/chat.model';

@Component({
  selector: 'app-chat-user-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex justify-end">
      <div class="chat-bubble chat-bubble--user">
        <p class="text-sm">{{ message().content }}</p>
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
    .chat-bubble--user {
      background: hsl(var(--p) / 0.15);
      color: hsl(var(--bc));
      border-bottom-right-radius: 0.25rem;
    }
  `],
})
export class ChatUserMessageComponent {
  readonly message = input.required<ChatMessage>();
}
