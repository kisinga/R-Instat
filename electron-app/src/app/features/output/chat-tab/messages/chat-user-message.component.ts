import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ChatMessage } from '../../../../core/models/chat.model';

@Component({
  selector: 'app-chat-user-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chat chat-end">
      <div class="chat-bubble chat-bubble-primary text-sm whitespace-pre-wrap">{{ message().content }}</div>
    </div>
  `,
})
export class ChatUserMessageComponent {
  readonly message = input.required<ChatMessage>();
}
