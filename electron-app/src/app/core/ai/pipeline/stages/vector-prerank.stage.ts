import { Injectable, inject } from '@angular/core';
import type { PipelineStage, StageResult } from '../stage';
import { Stage } from '../stage';
import type { PipelineContext } from '../context';
import { AIConfigService } from '../../../services/ai-config.service';
import { VectorIndexService } from '../../../vector/vector-index.service';

@Injectable({ providedIn: 'root' })
export class VectorPreRankStage implements PipelineStage {
  readonly id = 'vector-prerank';
  readonly errorPolicy = 'warn' as const;

  private readonly aiConfig = inject(AIConfigService);
  private readonly vectorIndex = inject(VectorIndexService, { optional: true });

  async execute(ctx: PipelineContext): Promise<StageResult> {
    const settings = this.aiConfig.retrievalSettings();
    if (!settings.useDialogContractRetrieval || !this.vectorIndex) {
      return Stage.continue();
    }

    await this.vectorIndex.ensureIndexed();

    ctx.state.preRankedCandidates = await this.vectorIndex.preRankDialogs(
      ctx.state.aliasedInput!,
      settings.topKContracts,
      ctx.state.family
    );

    ctx.diagnostics.debugLog.push(
      `[vector-prerank] Got ${ctx.state.preRankedCandidates?.length ?? 0} pre-ranked candidates`
    );
    return Stage.continue();
  }
}
