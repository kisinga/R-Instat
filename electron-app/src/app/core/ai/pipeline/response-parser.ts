/**
 * Unified response parser for all LLM responses.
 *
 * Every AI response MUST use the envelope format:
 *   { "type": "<envelope-type>", "body": { ... } }
 *
 * The single public method is extractEnvelope(). All parsing
 * goes through it — no exceptions, no fallbacks.
 */

import { Injectable } from '@angular/core';
import type { AIResponseEnvelope } from '../types/ai-envelope.types';

@Injectable({ providedIn: 'root' })
export class ResponseParser {
  /**
   * Extract an envelope-wrapped response: { "type": "...", "body": { ... } }
   *
   * Strict: rejects any response that doesn't match the envelope shape
   * or doesn't have the expected type.
   *
   * @param content Raw LLM response string
   * @param expectedType The expected envelope type (e.g. 'education', 'plan', 'classification')
   * @param bodyValidator Validates and transforms the body payload. Return null to reject.
   * @returns The validated body, or null on failure
   */
  extractEnvelope<T>(
    content: string,
    expectedType: string,
    bodyValidator: (body: unknown) => T | null
  ): T | null {
    const envelope = this.parseEnvelope(content);
    if (!envelope || envelope.type !== expectedType) return null;
    return bodyValidator(envelope.body);
  }

  /** Parse raw content into an envelope, handling LLM output quirks (fences, embedded JSON). */
  private parseEnvelope(content: string): AIResponseEnvelope | null {
    const jsonStr = this.extractJsonString(content);
    if (!jsonStr) return null;

    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed !== 'object' || parsed === null) return null;
      const obj = parsed as Record<string, unknown>;
      if (typeof obj['type'] !== 'string' || !('body' in obj)) return null;
      return { type: obj['type'] as string, body: obj['body'] };
    } catch {
      return null;
    }
  }

  /** Extract JSON string from content, handling various LLM output formats. */
  private extractJsonString(content: string): string | null {
    const trimmed = content.trim();

    // Direct JSON object
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }

    // Markdown fenced code block
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      return fenced[1].trim();
    }

    // JSON embedded in prose — find outermost braces
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return trimmed.slice(first, last + 1);
    }

    return null;
  }
}
