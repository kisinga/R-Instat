import { Injectable, inject } from '@angular/core';
import type { PipelineStage, StageResult } from '../stage';
import { Stage } from '../stage';
import type { PipelineContext } from '../context';
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

  async execute(ctx: PipelineContext): Promise<StageResult> {
    const settings = this.aiConfig.retrievalSettings();
    const retrievalContext = {
      activeDataframe: ctx.state.aliasedContext!.activeDataframe,
      columnsByDataframe: ctx.state.aliasedContext!.columnsByDataframe,
    };

    ctx.state.scopedContext = this.scoper.scope(
      ctx.state.category!,
      ctx.state.family,
      ctx.state.aliasedInput!,
      retrievalContext,
      settings.topKContracts,
      ctx.state.preRankedCandidates
    );

    ctx.state.scopedDialogIds = ctx.state.scopedContext.contracts.map((c) => c.dialogId);

    const currentDialogId = this.dialogRegistry.getCurrentDescriptor()?.id ?? 'none';
    ctx.diagnostics.debugLog.push(
      `[scope] category=${ctx.state.category}, mode=${ctx.state.scopedContext.executionMode}, contracts=[${ctx.state.scopedDialogIds.join(', ')}], currentDialog=${currentDialogId}`
    );

    ctx.state.modeDecision = {
      mode: ctx.state.scopedContext.executionMode,
      reason: `Pipeline category: ${ctx.state.category}`,
      confidence: 0.85,
    };

    // Build retrieval report
    ctx.state.retrievalReport = {
      enabled: true,
      topK: settings.topKContracts,
      selectedDialogIds: ctx.state.scopedDialogIds,
      explainability: [],
    };

    // Build operations and contracts JSON for prompt
    const scopedOperations = filterOperationsForScopedDialogs(
      OPERATION_REGISTRY,
      ctx.state.scopedDialogIds
    );
    const compactContracts = buildPlanningContractViews(
      ctx.state.scopedContext.contracts,
      getSchema
    );

    // Retrieve similar past interactions for few-shot examples
    let pastInteractions: Array<{ query: string; dialogId: string; state: Record<string, unknown> }> | undefined;
    if (this.vectorMemory?.isReady()) {
      try {
        const similar = await this.vectorMemory.getSimilarInteractions(ctx.state.aliasedInput!, 3);
        if (similar.length > 0) {
          pastInteractions = similar.map(s => ({
            query: s.query,
            dialogId: s.dialogId,
            state: s.state,
          }));
        }
      } catch {
        ctx.diagnostics.debugLog.push('[scope] Vector memory retrieval failed');
      }
    }

    // Build the user message for the LLM
    ctx.state.userMessage = buildUserMessage({
      userInput: ctx.state.aliasedInput!,
      dataContext: ctx.state.aliasedContext!,
      operationsJson: JSON.stringify(scopedOperations),
      contractsJson: JSON.stringify(compactContracts),
      mode: ctx.state.modeDecision.mode,
      scopedDialogIds: ctx.state.scopedDialogIds,
      currentDialogContext: ctx.state.scopedContext.currentDialogContext,
      category: ctx.state.category,
      pastInteractions,
    });

    return Stage.continue();
  }
}
