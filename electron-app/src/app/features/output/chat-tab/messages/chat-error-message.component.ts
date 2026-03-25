import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ChatMessage } from '../../../../core/models/chat.model';

@Component({
  selector: 'app-chat-error-message',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex justify-start">
      <div class="chat-bubble chat-bubble--error">
        <div class="flex items-center gap-2">
          <svg class="h-4 w-4 text-error flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p class="text-sm text-error">{{ message().content }}</p>
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
    .chat-bubble--error {
      background: hsl(var(--er) / 0.1);
      border: 1px solid hsl(var(--er) / 0.3);
      border-bottom-left-radius: 0.25rem;
    }
  `],
})
export class ChatErrorMessageComponent {
  readonly message = input.required<ChatMessage>();
}
