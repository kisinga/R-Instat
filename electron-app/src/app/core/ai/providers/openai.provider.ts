import type { IPCBridge } from '../ipc/ipc-bridge';
import type { LLMProvider, LLMRequest, LLMResponse } from './llm-provider';

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai' as const;

  constructor(private readonly ipc: IPCBridge) {}

  async call(apiKey: string, request: LLMRequest): Promise<LLMResponse> {
    if (!this.ipc.isAiAvailable()) {
      throw new Error('OpenAI requires Electron IPC bridge. Restart the Electron app.');
    }

    const result = await this.ipc.rawChat({
      provider: 'openai',
      apiKey,
      systemPrompt: request.systemPrompt,
      userMessage: request.userMessage,
      responseFormat: request.responseFormat,
      model: request.model ?? 'gpt-4o-mini',
      temperature: request.temperature ?? 0.2,
      maxTokens: request.maxTokens,
    });

    if (!result.ok || !result.content) {
      throw new Error(result.error ?? 'Empty response from OpenAI');
    }

    return { content: result.content };
  }
}
