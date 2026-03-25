import { Injectable, inject } from '@angular/core';
import type { PipelineStage, StageResult } from '../stage';
import { Stage } from '../stage';
import type { PipelineContext } from '../context';
import { AIConfigService } from '../../../services/ai-config.service';
import {
  aliasDataContext,
  applyAliasesToInput,
  buildPrivacyReport,
  redactUserInput,
} from '../../pii-guard';

@Injectable({ providedIn: 'root' })
export class PiiGuardStage implements PipelineStage {
  readonly id = 'pii-guard';
  readonly errorPolicy = 'fatal' as const;

  private readonly aiConfig = inject(AIConfigService);

  async execute(ctx: PipelineContext): Promise<StageResult> {
    const { context: aliasedContext, maps } = aliasDataContext(ctx.inputs.dataContext);

    if (this.aiConfig.piiRedactionEnabled()) {
      const redacted = redactUserInput(ctx.inputs.userInput);
      ctx.state.aliasedInput = applyAliasesToInput(redacted.value, maps);
      ctx.state.privacyReport = buildPrivacyReport(redacted.patterns, maps);
    } else {
      ctx.state.aliasedInput = applyAliasesToInput(ctx.inputs.userInput, maps);
      ctx.state.privacyReport = buildPrivacyReport([], maps);
    }

    ctx.state.aliasedContext = aliasedContext;
    ctx.state.aliasMaps = maps;
    return Stage.continue();
  }
}
