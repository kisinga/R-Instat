import { Injectable, inject } from '@angular/core';
import type { PipelineStage, PipelineContext } from '../pipeline-stage';
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

  async execute(ctx: PipelineContext): Promise<boolean> {
    const { context: aliasedContext, maps } = aliasDataContext(ctx.rawDataContext);

    if (this.aiConfig.piiRedactionEnabled()) {
      const redacted = redactUserInput(ctx.rawUserInput);
      ctx.aliasedInput = applyAliasesToInput(redacted.value, maps);
      ctx.privacyReport = buildPrivacyReport(redacted.patterns, maps);
    } else {
      ctx.aliasedInput = applyAliasesToInput(ctx.rawUserInput, maps);
      ctx.privacyReport = buildPrivacyReport([], maps);
    }

    ctx.aliasedContext = aliasedContext;
    ctx.aliasMaps = maps;
    return true;
  }
}
