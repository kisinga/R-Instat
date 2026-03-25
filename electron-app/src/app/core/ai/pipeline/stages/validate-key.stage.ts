import { Injectable, inject } from '@angular/core';
import type { PipelineStage, StageResult } from '../stage';
import { Stage } from '../stage';
import type { PipelineContext } from '../context';
import { AIConfigService } from '../../../services/ai-config.service';

@Injectable({ providedIn: 'root' })
export class ValidateKeyStage implements PipelineStage {
  readonly id = 'validate-key';
  readonly errorPolicy = 'fatal' as const;

  private readonly aiConfig = inject(AIConfigService);

  async execute(ctx: PipelineContext): Promise<StageResult> {
    const provider = this.aiConfig.provider();
    const apiKey = this.aiConfig.apiKey();

    if (!apiKey?.trim()) {
      const label = provider === 'claude' ? 'Claude' : 'OpenAI';
      return Stage.terminate({
        success: false,
        error: `No API key. Add your ${label} API key in AI Settings.`,
      });
    }

    ctx.state.apiKey = apiKey;
    ctx.state.provider = provider;
    return Stage.continue();
  }
}
