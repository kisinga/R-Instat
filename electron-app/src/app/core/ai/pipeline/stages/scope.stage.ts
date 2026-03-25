import { Injectable, inject } from '@angular/core';
import type { PipelineStage, PipelineContext } from '../pipeline-stage';
import { AIConfigService } from '../../../services/ai-config.service';
import { PromptScoperService } from '../../prompt-scoper.service';
import { CurrentDialogueRegistryService } from '../../current-dialogue-registry.service';
import { OPERATION_REGISTRY } from '../../operation-registry';
import {
  filterOperationsForScopedDialogs,
  buildPlanningContractViews,
} from '../../planner-context';
import { getSchema } from '../../dialog-catalog-aggregator';
import { buildUserMessage } from '../../prompt/prompt-builder';
import { VectorMemoryService } from '../../../vector/vector-memory.service';

@Injectable({ providedIn: 'root' })
export class ScopeStage implements PipelineStage {
  readonly id = 'scope';
  readonly errorPolicy = 'fatal' as const;

  private readonly aiConfig = inject(AIConfigService);
  private readonly scoper = inject(PromptScoperService);
  private readonly dialogRegistry = inject(CurrentDialogueRegistryService);
  private readonly vectorMemory = inject(VectorMemoryService, { optional: true });

  async execute(ctx: PipelineContext): Promise<boolean> {
    const settings = this.aiConfig.retrievalSettings();
    const retrievalContext = {
      activeDataframe: ctx.aliasedContext!.activeDataframe,
      columnsByDataframe: ctx.aliasedContext!.columnsByDataframe,
    };

    ctx.scopedContext = this.scoper.scope(
      ctx.category!,
      ctx.family,
      ctx.aliasedInput!,
      retrievalContext,
      settings.topKContracts,
      ctx.preRankedCandidates
    );

    ctx.scopedDialogIds = ctx.scopedContext.contracts.map((c) => c.dialogId);

    const currentDialogId = this.dialogRegistry.getCurrentDescriptor()?.id ?? 'none';
    ctx.debugLog.push(
      `[scope] category=${ctx.category}, mode=${ctx.scopedContext.executionMode}, contracts=[${ctx.scopedDialogIds.join(', ')}], currentDialog=${currentDialogId}`
    );

    ctx.modeDecision = {
      mode: ctx.scopedContext.executionMode,
      reason: `Pipeline category: ${ctx.category}`,
      confidence: 0.85,
    };

    // Build retrieval report
    ctx.retrievalReport = {
      enabled: true,
      topK: settings.topKContracts,
      selectedDialogIds: ctx.scopedDialogIds,
      explainability: [],
    };

    // Build operations and contracts JSON for prompt
    const scopedOperations = filterOperationsForScopedDialogs(
      OPERATION_REGISTRY,
      ctx.scopedDialogIds
    );
    const compactContracts = buildPlanningContractViews(
      ctx.scopedContext.contracts,
      getSchema
    );

    // Retrieve similar past interactions for few-shot examples
    let pastInteractions: Array<{ query: string; dialogId: string; state: Record<string, unknown> }> | undefined;
    if (this.vectorMemory?.isReady()) {
      try {
        const similar = await this.vectorMemory.getSimilarInteractions(ctx.aliasedInput!, 3);
        if (similar.length > 0) {
          pastInteractions = similar.map(s => ({
            query: s.query,
            dialogId: s.dialogId,
            state: s.state,
          }));
        }
      } catch {
        ctx.debugLog.push('[scope] Vector memory retrieval failed');
      }
    }

    // Build the user message for the LLM
    ctx.userMessage = buildUserMessage({
      userInput: ctx.aliasedInput!,
      dataContext: ctx.aliasedContext!,
      operationsJson: JSON.stringify(scopedOperations),
      contractsJson: JSON.stringify(compactContracts),
      mode: ctx.modeDecision.mode,
      scopedDialogIds: ctx.scopedDialogIds,
      currentDialogContext: ctx.scopedContext.currentDialogContext,
      category: ctx.category,
      pastInteractions,
    });

    return true;
  }
}
