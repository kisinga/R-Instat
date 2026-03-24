/**
 * AI Assist error card: error message and optional raw response preview.
 */

import { Component, input } from '@angular/core';

@Component({
  selector: 'app-ai-assist-error-card',
  standalone: true,
  template: `
    <div class="alert alert-error mt-4">
      <div>
        <p class="font-medium">{{ error() }}</p>
        @if (rawResponse()) {
          <pre class="text-xs mt-2 overflow-x-auto max-h-24">{{ rawResponse() }}</pre>
        }
      </div>
    </div>
  `,
})
export class AiAssistErrorCardComponent {
  readonly error = input.required<string>();
  readonly rawResponse = input<string | undefined>(undefined);
}
