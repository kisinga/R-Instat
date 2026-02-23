/**
 * AI Plan Queue Service
 *
 * Stores validated multi-step plans and allows step-by-step continuation.
 */

import { Injectable, signal, computed } from '@angular/core';
import type { ResolvedPlan, ResolvedPlanStep } from './intent-resolver.service';

@Injectable({ providedIn: 'root' })
export class AIPlanQueueService {
  private readonly _plan = signal<ResolvedPlan | null>(null);
  private readonly _index = signal(0);

  readonly plan = this._plan.asReadonly();
  readonly index = this._index.asReadonly();
  readonly hasPlan = computed(() => this._plan() !== null);
  readonly currentStep = computed<ResolvedPlanStep | null>(() => {
    const plan = this._plan();
    if (!plan) return null;
    const i = this._index();
    return plan.steps[i] ?? null;
  });
  readonly hasNext = computed(() => {
    const plan = this._plan();
    if (!plan) return false;
    return this._index() < plan.steps.length - 1;
  });

  setPlan(plan: ResolvedPlan): void {
    this._plan.set(plan);
    this._index.set(0);
  }

  clear(): void {
    this._plan.set(null);
    this._index.set(0);
  }

  advance(): void {
    const plan = this._plan();
    if (!plan) return;
    const next = this._index() + 1;
    if (next < plan.steps.length) {
      this._index.set(next);
    }
  }

  setIndex(index: number): void {
    const plan = this._plan();
    if (!plan) return;
    if (index < 0 || index >= plan.steps.length) return;
    this._index.set(index);
  }
}

