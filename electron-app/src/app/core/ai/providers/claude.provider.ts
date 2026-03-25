import type { IPCBridge } from '../ipc/ipc-bridge';
import type { LLMProvider, LLMRequest, LLMResponse } from './llm-provider';

export class ClaudeProvider implements LLMProvider {
  readonly id = 'claude' as const;

  constructor(private readonly ipc: IPCBridge) {}

  async call(apiKey: string, request: LLMRequest): Promise<LLMResponse> {
    if (!this.ipc.isAiAvailable()) {
      throw new Error('Claude requires Electron IPC bridge. Restart the Electron app.');
    }

    const result = await this.ipc.rawChat({
      provider: 'claude',
      apiKey,
      systemPrompt: request.systemPrompt,
      userMessage: request.userMessage,
      responseFormat: request.responseFormat,
      model: request.model ?? 'claude-haiku-4-5',
      temperature: request.temperature ?? 0.2,
      maxTokens: request.maxTokens ?? 1800,
    });

    if (!result.ok || !result.content) {
      throw new Error(result.error ?? 'Empty response from Claude');
    }

    return { content: result.content };
  }
}
