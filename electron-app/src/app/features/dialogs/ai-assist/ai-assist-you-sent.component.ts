/**
 * "You sent" line showing the last user message for conversation context.
 */

import { Component, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-ai-assist-you-sent',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <div class="ai-assist-you-sent mt-4">
      <span class="ai-assist-you-sent-label">{{ 'AI_ASSIST.YOU_SENT' | translate }}:</span>
      <span class="ai-assist-you-sent-text">{{ message() }}</span>
    </div>
  `,
  styles: [`
    .ai-assist-you-sent { font-size: 0.8125rem; color: hsl(var(--bc) / 0.85); }
    .ai-assist-you-sent-label { font-weight: 600; margin-right: 0.25rem; }
    .ai-assist-you-sent-text { font-style: italic; }
  `],
})
export class AiAssistYouSentComponent {
  readonly message = input.required<string>();
}
