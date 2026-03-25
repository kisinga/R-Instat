import { Component, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import type { ChatMessage } from '../../../../core/models/chat.model';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-chat-code-message',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="chat chat-start">
      <div class="chat-header">
        <span class="text-xs opacity-50">AI</span>
        <span
          class="badge badge-xs ml-1"
          [class.badge-success]="codePayload().success"
          [class.badge-error]="!codePayload().success"
        >
          {{ codePayload().success ? ('AI_CHAT.CODE_SUCCESS' | translate) : ('AI_CHAT.CODE_FAILED' | translate) }}
        </span>
      </div>
      <div class="chat-bubble chat-bubble-ghost code-bubble">
        <pre class="text-xs whitespace-pre-wrap font-mono bg-base-300/50 rounded p-2 overflow-x-auto m-0">{{ codePayload().script }}</pre>
        @if (codePayload().output) {
          <p class="text-xs opacity-60 mt-2 break-words">{{ codePayload().output }}</p>
        }
      </div>
      <div class="chat-footer">
        <button
          class="btn btn-ghost btn-xs opacity-40 hover:opacity-100 gap-1"
          (click)="copyCode()"
        >
          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy code
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
    .code-bubble {
      max-width: 95%;
    }
  `],
})
export class ChatCodeMessageComponent {
  readonly message = input.required<ChatMessage>();
  private readonly toast = inject(ToastService);

  codePayload() {
    const p = this.message().payload;
    if (p.type === 'code-result') return p;
    return { script: '', success: false, output: undefined };
  }

  copyCode(): void {
    navigator.clipboard.writeText(this.codePayload().script).then(
      () => this.toast.success('Code copied to clipboard'),
      () => this.toast.error('Failed to copy code')
    );
  }
}
