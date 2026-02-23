import { Injectable } from '@angular/core';
import type { AIPlan, ExecutionMode } from './ai-client.service';

const STORAGE_KEY = 'r-instat-ai-eval-telemetry-v1';

export interface AIEvalCounters {
  totalRequests: number;
  successfulPlans: number;
  correctionWarnings: number;
  modeCounts: Record<ExecutionMode, number>;
  failuresByClass: Record<string, number>;
}

export interface PromptBenchmarkCase {
  id: string;
  prompt: string;
  expectedMode: ExecutionMode;
  minConfidence: number;
}

@Injectable({ providedIn: 'root' })
export class AIEvalService {
  private counters: AIEvalCounters = this.load();

  recordSuccess(plan: AIPlan, warningCount: number): void {
    this.counters.totalRequests += 1;
    this.counters.successfulPlans += 1;
    this.counters.correctionWarnings += Math.max(0, warningCount);
    this.counters.modeCounts[plan.executionMode] += 1;
    this.persist();
  }

  recordFailure(reasonClass: string): void {
    this.counters.totalRequests += 1;
    this.counters.failuresByClass[reasonClass] = (this.counters.failuresByClass[reasonClass] ?? 0) + 1;
    this.persist();
  }

  snapshot(): AIEvalCounters {
    return JSON.parse(JSON.stringify(this.counters)) as AIEvalCounters;
  }

  runOfflineBenchmarks(cases: PromptBenchmarkCase[], plans: AIPlan[]): {
    total: number;
    modeMatches: number;
    confidencePass: number;
  } {
    let modeMatches = 0;
    let confidencePass = 0;
    const byId = new Map(plans.map((p) => [p.goal, p]));
    for (const c of cases) {
      const plan = byId.get(c.prompt);
      if (!plan) continue;
      if (plan.executionMode === c.expectedMode) modeMatches += 1;
      if (plan.modeConfidence >= c.minConfidence) confidencePass += 1;
    }
    return { total: cases.length, modeMatches, confidencePass };
  }

  private load(): AIEvalCounters {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AIEvalCounters>;
        return {
          totalRequests: parsed.totalRequests ?? 0,
          successfulPlans: parsed.successfulPlans ?? 0,
          correctionWarnings: parsed.correctionWarnings ?? 0,
          modeCounts: {
            component_codegen: parsed.modeCounts?.component_codegen ?? 0,
            structured_codegen: parsed.modeCounts?.structured_codegen ?? 0,
            direct_r: parsed.modeCounts?.direct_r ?? 0,
          },
          failuresByClass: parsed.failuresByClass ?? {},
        };
      }
    } catch {
      // ignore parse issues and reset telemetry
    }
    return {
      totalRequests: 0,
      successfulPlans: 0,
      correctionWarnings: 0,
      modeCounts: {
        component_codegen: 0,
        structured_codegen: 0,
        direct_r: 0,
      },
      failuresByClass: {},
    };
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.counters));
  }
}
