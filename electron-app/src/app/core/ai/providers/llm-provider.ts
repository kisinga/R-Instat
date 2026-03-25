export interface LLMRequest {
  systemPrompt: string;
  userMessage: string;
  responseFormat: 'json' | 'text';
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
}

export interface LLMProvider {
  readonly id: 'openai' | 'claude';
  call(apiKey: string, request: LLMRequest): Promise<LLMResponse>;
}
