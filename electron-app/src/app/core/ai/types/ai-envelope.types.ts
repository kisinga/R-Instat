/**
 * Unified AI response envelope.
 *
 * Every LLM JSON response wraps its payload in this envelope so the
 * parser can dispatch on `type` without knowing the body shape upfront.
 * New response types (e.g. "summary", "code-review") can be added here
 * without touching parsing infrastructure.
 */

export interface AIResponseEnvelope<T = unknown> {
  type: string;
  body: T;
}

/** Known envelope types — extend as new response kinds are added. */
export type AIEnvelopeType = 'plan' | 'education' | 'classification';
