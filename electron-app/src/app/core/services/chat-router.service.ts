/**
 * Chat Router Service — thin orchestrator.
 *
 * Single entry point for all AI chat interactions. Routes user input
 * to the appropriate pipeline (education vs action) and maps results
 * into ChatStoreService messages.
 */

import { Injectable, inject, signal } from '@angular/core';
import { ChatStoreService } from './chat-store.service';
import { DataContextBuilder } from './data-context-builder.service';
import { HighlightEnricherService } from './highlight-enricher.service';
import { AIPipeline } from '../ai/pipeline/ai-pipeline';
import { EducationPipeline } from '../ai/pipeline/education-pipeline';
import { AIClientService } from './ai-client.service';
import { IntentResolverService } from './intent-resolver.service';
import { ruleBasedCategorizer } from '../ai/categorizer-rules';
import { CurrentDialogueRegistryService } from '../ai/current-dialogue-registry.service';
import type { ConversationTurn } from '../ai/pipeline/context';

@Injectable({ providedIn: 'root' })
export class ChatRouterService {
  private readonly store = inject(ChatStoreService);
  private readonly contextBuilder = inject(DataContextBuilder);
  private readonly educationPipeline = inject(EducationPipeline);
  private readonly aiClient = inject(AIClientService);
  private readonly intentResolver = inject(IntentResolverService);
  private readonly highlightEnricher = inject(HighlightEnricherService);
  private readonly dialogRegistry = inject(CurrentDialogueRegistryService);

  readonly isLoading = signal(false);

  async send(input: string): Promise<void> {
    if (!input.trim() || this.isLoading()) return;

    this.store.appendUserMessage(input);
    this.isLoading.set(true);

    try {
      const dataContext = await this.contextBuilder.build();
      const hasActiveDialog = this.dialogRegistry.hasCurrent();

      const ruleResult = ruleBasedCategorizer(input, hasActiveDialog);

      if (ruleResult?.category === 'education_question') {
        await this.handleEducation(input, dataContext);
      } else {
        await this.handleAction(input, dataContext);
      }
    } catch (err) {
      this.store.appendErrorMessage(
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  private async handleEducation(
    input: string,
    dataContext: import('../ai/types/data-context.types').DataContext
  ): Promise<void> {
    const history = this.buildHistory();
    const result = await this.educationPipeline.execute(input, dataContext, history);

    if (result.success && result.response) {
      const highlights = this.highlightEnricher.enrich(result.response.highlights);
      this.store.appendEducationMessage(
        result.response.explanation,
        highlights,
        result.response.followUpSuggestions
      );
    } else {
      this.store.appendErrorMessage(result.error ?? 'Failed to get response.');
    }
  }

  private async handleAction(
    input: string,
    dataContext: import('../ai/types/data-context.types').DataContext
  ): Promise<void> {
    const result = await this.aiClient.call(input, dataContext);

    if (result.success && result.plan) {
      const resolved = this.intentResolver.resolve(result, dataContext);
      if (resolved.ok && resolved.plan) {
        this.store.appendPlanMessage(resolved.plan.goal, resolved.plan);
      } else {
        this.store.appendErrorMessage(resolved.error ?? 'Failed to resolve plan.');
      }
    } else if (result.needsDisambiguation && result.disambiguationSuggestions?.length) {
      this.store.appendDisambiguationMessage(
        result.disambiguationSuggestions.map(s => ({ text: s.text, category: s.category }))
      );
    } else {
      this.store.appendErrorMessage(result.error ?? 'AI request failed.');
    }
  }

  private buildHistory(): ConversationTurn[] {
    const conv = this.store.activeConversation();
    if (!conv) return [];
    return conv.messages.slice(-6).map(m => ({
      role: m.role === 'system' ? 'assistant' as const : m.role,
      content: m.content,
    }));
  }
}
