/**
 * Unified chat model with discriminated union payloads.
 *
 * Replaces education-chat.model.ts. A single ChatMessage type
 * supports education, action-plan, code-result, disambiguation,
 * and error message types via the discriminated `payload` field.
 */

import type { ResolvedPlan } from '../services/intent-resolver.service';

/** Reusable highlight linking a dialog to a concept */
export interface SystemHighlight {
  dialogId: string;
  dialogLabel: string;
  family: string;
  menuPath: string[];
  relevanceNote: string;
}

/** Discriminated union for message payloads — typed by payload.type */
export type MessagePayload =
  | { type: 'text' }
  | { type: 'education'; highlights: SystemHighlight[]; followUpSuggestions: string[] }
  | { type: 'action-plan'; plan: ResolvedPlan }
  | { type: 'code-result'; script: string; output?: string; success: boolean }
  | { type: 'disambiguation'; suggestions: Array<{ text: string; category: string }> }
  | { type: 'error'; errorDetail?: string };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  payload: MessagePayload;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/**
 * LLM parse output for education responses.
 * Mapped into ChatMessage with payload.type === 'education' at the store layer.
 */
export interface EducationAIResponse {
  explanation: string;
  highlights: Array<{ dialogId: string; relevanceNote: string }>;
  followUpSuggestions: string[];
}
