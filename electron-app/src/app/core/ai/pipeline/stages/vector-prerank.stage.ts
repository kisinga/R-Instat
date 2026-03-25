import { Injectable, inject } from '@angular/core';
import type { PipelineStage, PipelineContext } from '../pipeline-stage';
import { AIConfigService } from '../../../services/ai-config.service';
import { VectorIndexService } from '../../../vector/vector-index.service';

@Injectable({ providedIn: 'root' })
export class VectorPreRankStage implements PipelineStage {
  readonly id = 'vector-prerank';
  readonly errorPolicy = 'warn' as const;

  private readonly aiConfig = inject(AIConfigService);
  private readonly vectorIndex = inject(VectorIndexService, { optional: true });

  async execute(ctx: PipelineContext): Promise<boolean> {
    const settings = this.aiConfig.retrievalSettings();
    if (!settings.useDialogContractRetrieval || !this.vectorIndex) {
      return true;
    }

    await this.vectorIndex.ensureIndexed();

    ctx.preRankedCandidates = await this.vectorIndex.preRankDialogs(
      ctx.aliasedInput!,
      settings.topKContracts,
      ctx.family
    );

    ctx.debugLog.push(
      `[vector-prerank] Got ${ctx.preRankedCandidates?.length ?? 0} pre-ranked candidates`
    );
    return true;
  }
}
