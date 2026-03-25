import type { IPCBridge } from '../ipc/ipc-bridge';
import type { LLMProvider, LLMRequest, LLMResponse } from './llm-provider';

interface OpenAIResponsePayload {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai';

  constructor(private readonly ipc: IPCBridge) {}

  async call(apiKey: string, request: LLMRequest): Promise<LLMResponse> {
    if (!this.ipc.isAiAvailable()) {
      throw new Error(
        'OpenAI requires Electron IPC bridge. Restart the Electron app and open AI Assist inside the Electron window.'
      );
    }

    const response = await this.ipc.openaiChat({
      apiKey,
      system: request.systemPrompt,
      userMessage: request.userMessage,
      model: request.model ?? 'gpt-4o-mini',
      temperature: request.temperature ?? 0.2,
      responseFormat: request.responseFormat === 'json' ? 'json_object' : 'text',
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: HTTP ${response.status}`);
    }

    const payload = response.data as OpenAIResponsePayload;
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      const reason = payload.error?.message ?? 'Empty response from OpenAI';
      throw new Error(reason);
    }

    return { content };
  }
}
