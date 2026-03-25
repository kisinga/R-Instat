/**
 * Unified JSON extraction from LLM responses.
 *
 * Replaces the inconsistent parsing approaches:
 * - ParseResponseStage's extractJson() + JSON.parse
 * - EducationLlmCallStage's inline regex /\{[\s\S]*\}/
 * - PromptCategorizerService's extractJson() + JSON.parse
 *
 * Single implementation with consistent error handling.
 */

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ResponseParser {
  /**
   * Extract and parse JSON from LLM response content.
   * Handles markdown fenced code blocks, bare JSON, and JSON embedded in prose.
   *
   * @param content Raw LLM response string
   * @param validator Optional validator/transformer. Return null to reject.
   * @returns Parsed and validated object, or null on failure
   */
  extractJson<T>(content: string, validator?: (raw: unknown) => T | null): T | null {
    const jsonStr = this.extractJsonString(content);
    if (!jsonStr) return null;

    try {
      const parsed = JSON.parse(jsonStr);
      if (validator) {
        return validator(parsed);
      }
      return parsed as T;
    } catch {
      return null;
    }
  }

  /**
   * Extract JSON string from content, handling various LLM output formats.
   */
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
