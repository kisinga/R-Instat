import { Injectable, inject } from '@angular/core';
import { AIConfigService, type AIProvider } from '../../services/ai-config.service';
import { IPC_BRIDGE } from '../ipc/ipc-bridge';
import type { LLMProvider } from './llm-provider';
import { ClaudeProvider } from './claude.provider';
import { OpenAIProvider } from './openai.provider';

@Injectable({ providedIn: 'root' })
export class LLMProviderFactory {
  private readonly ipc = inject(IPC_BRIDGE);
  private readonly aiConfig = inject(AIConfigService);

  private claudeProvider?: ClaudeProvider;
  private openaiProvider?: OpenAIProvider;

  /** Get provider for the currently configured AI provider. */
  getProvider(): LLMProvider {
    return this.getProviderFor(this.aiConfig.provider());
  }

  /** Get provider by explicit provider id. */
  getProviderFor(provider: AIProvider): LLMProvider {
    if (provider === 'claude') {
      if (!this.claudeProvider) {
        this.claudeProvider = new ClaudeProvider(this.ipc);
      }
      return this.claudeProvider;
    }
    if (!this.openaiProvider) {
      this.openaiProvider = new OpenAIProvider(this.ipc);
    }
    return this.openaiProvider;
  }
}
