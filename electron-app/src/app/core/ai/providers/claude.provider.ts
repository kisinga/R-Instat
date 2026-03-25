import type { IPCBridge } from '../ipc/ipc-bridge';
import type { LLMProvider, LLMRequest, LLMResponse } from './llm-provider';

interface ClaudeResponsePayload {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
}

export class ClaudeProvider implements LLMProvider {
  readonly id = 'claude';

  constructor(private readonly ipc: IPCBridge) {}

  async call(apiKey: string, request: LLMRequest): Promise<LLMResponse> {
    if (!this.ipc.isAiAvailable()) {
      throw new Error(
        'Claude requires Electron IPC bridge. Restart the Electron app and open AI Assist inside the Electron window.'
      );
    }

    const response = await this.ipc.anthropicMessage({
      apiKey,
      system: request.systemPrompt,
      userMessage: request.userMessage,
      model: request.model ?? 'claude-haiku-4-5',
      maxTokens: request.maxTokens ?? 1800,
      temperature: request.temperature ?? 0.2,
    });

    const payload = response.data as ClaudeResponsePayload;
    if (!response.ok) {
      const reason = payload?.error?.message ?? `HTTP ${response.status}`;
      throw new Error(`Claude API error: ${reason}`);
    }

    const content = (payload.content ?? [])
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text ?? '')
      .join('\n')
      .trim();

    if (!content) {
      throw new Error('Empty response from Claude');
    }

    return { content };
  }
}
