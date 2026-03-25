import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ChatMessage } from '../../../../core/models/chat.model';

@Component({
  selector: 'app-chat-error-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chat chat-start">
      <div class="chat-bubble chat-bubble-error text-sm">
        <div class="flex items-start gap-2">
          <svg class="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p class="break-words">{{ message().content }}</p>
        </div>
      </div>
    </div>
  `,
})
export class ChatErrorMessageComponent {
  readonly message = input.required<ChatMessage>();
}
