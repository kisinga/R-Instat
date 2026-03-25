/**
 * Instructor.js integration for structured LLM output extraction.
 *
 * Runs in the Electron main process. Wraps OpenAI/Anthropic SDK clients
 * with Instructor for Zod-validated structured output with auto-retry.
 */

import Instructor from '@instructor-ai/instructor';
import OpenAI from 'openai';
import { PlanSchema, type AIPlanFromSchema } from './schemas/plan.schema';

export interface StructuredPlanRequest {
  provider: 'openai' | 'claude';
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface StructuredPlanResponse {
  ok: true;
  plan: AIPlanFromSchema;
}

export interface StructuredPlanError {
  ok: false;
  error: string;
}

export type StructuredPlanResult = StructuredPlanResponse | StructuredPlanError;

export interface RawChatRequest {
  provider: 'openai' | 'claude';
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  responseFormat: 'json' | 'text';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface RawChatResult {
  ok: boolean;
  content?: string;
  error?: string;
}

function createOpenAIClient(provider: 'openai' | 'claude', apiKey: string): OpenAI {
  if (provider === 'claude') {
    return new OpenAI({
      apiKey,
      baseURL: 'https://api.anthropic.com/v1/',
      defaultHeaders: {
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
    });
  }
  return new OpenAI({ apiKey });
}

function getDefaultModel(provider: 'openai' | 'claude'): string {
  return provider === 'claude' ? 'claude-haiku-4-5' : 'gpt-4o-mini';
}

/**
 * Extract a validated plan from the LLM using Instructor.js + Zod.
 * Instructor auto-retries on validation failure (max 2 retries).
 */
export async function extractStructuredPlan(
  request: StructuredPlanRequest
): Promise<StructuredPlanResult> {
  try {
    const oai = createOpenAIClient(request.provider, request.apiKey);
    const client = Instructor({ client: oai, mode: 'TOOLS' });

    const plan = await client.chat.completions.create({
      model: request.model ?? getDefaultModel(request.provider),
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 1800,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userMessage },
      ],
      response_model: {
        schema: PlanSchema,
        name: 'Plan',
      },
      max_retries: 2,
    });

    return { ok: true, plan };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ai-instructor] Structured plan extraction failed:', message);
    return { ok: false, error: message };
  }
}

/**
 * Raw LLM chat call — used for education pipeline and direct-R.
 * No Instructor wrapping, just a plain OpenAI-compatible call.
 */
export async function rawChat(request: RawChatRequest): Promise<RawChatResult> {
  try {
    const oai = createOpenAIClient(request.provider, request.apiKey);

    const response = await oai.chat.completions.create({
      model: request.model ?? getDefaultModel(request.provider),
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 1800,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userMessage },
      ],
      ...(request.responseFormat === 'json'
        ? { response_format: { type: 'json_object' as const } }
        : {}),
    });

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { ok: false, error: 'Empty response from LLM' };
    }

    return { ok: true, content };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ai-instructor] Raw chat call failed:', message);
    return { ok: false, error: message };
  }
}
