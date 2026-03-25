/**
 * Centralized error classification and user-friendly message generation.
 *
 * Replaces the duplicated friendlyError() / buildErrorResult() methods
 * in both AIPipeline and EducationPipeline.
 */

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ErrorNormalizer {
  normalize(rawError: string, provider?: 'openai' | 'claude'): string {
    const lower = rawError.toLowerCase();

    if (this.isAuthError(lower)) {
      return 'Invalid API key. Check your key in AI Settings.';
    }

    if (this.isQuotaError(lower)) {
      return this.quotaMessage(provider);
    }

    return rawError;
  }

  private isAuthError(msg: string): boolean {
    return (
      msg.includes('401') ||
      msg.includes('403') ||
      msg.includes('incorrect api key') ||
      msg.includes('invalid x-api-key') ||
      msg.includes('invalid api key')
    );
  }

  private isQuotaError(msg: string): boolean {
    return (
      msg.includes('429') ||
      msg.includes('quota') ||
      msg.includes('rate limit') ||
      msg.includes('insufficient_quota')
    );
  }

  private quotaMessage(provider?: string): string {
    if (provider === 'claude') {
      return 'Claude quota/rate limit reached (429). Check your Anthropic billing/plan, or switch provider to OpenAI in AI Settings.';
    }
    return 'OpenAI quota exceeded (429). Check your OpenAI billing/plan, or switch provider to Claude in AI Settings.';
  }
}
