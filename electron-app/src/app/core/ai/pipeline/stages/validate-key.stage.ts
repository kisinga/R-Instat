import { Injectable, inject } from '@angular/core';
import type { PipelineStage, PipelineContext } from '../pipeline-stage';
import { AIConfigService } from '../../../services/ai-config.service';

@Injectable({ providedIn: 'root' })
export class ValidateKeyStage implements PipelineStage {
  readonly id = 'validate-key';
  readonly errorPolicy = 'fatal' as const;

  private readonly aiConfig = inject(AIConfigService);

  async execute(ctx: PipelineContext): Promise<boolean> {
    const provider = this.aiConfig.provider();
    const apiKey = this.aiConfig.apiKey();

    if (!apiKey?.trim()) {
      const label = provider === 'claude' ? 'Claude' : 'OpenAI';
      ctx.earlyResult = {
        success: false,
        error: `No API key. Add your ${label} API key in Settings.`,
      };
      return false;
    }

    ctx.apiKey = apiKey;
    ctx.provider = provider;
    return true;
  }
}
