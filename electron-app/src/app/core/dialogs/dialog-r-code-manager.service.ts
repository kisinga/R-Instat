/**
 * Dialog R Code Manager Service
 *
 * Manages RSyntax state for dialog instances, providing reactive code generation
 * and execution. This service bridges dialog components with the R code generation
 * system using Angular's signal-based reactivity.
 *
 * Key Features:
 * - RSyntax state management via signals
 * - Reactive code generation (computed signals)
 * - Builder function pattern for automatic updates
 * - Assignment configuration
 * - Before/after code management
 * - Execution orchestration
 */

import { Injectable, signal, computed, effect } from '@angular/core';
import { RSyntax } from '../r-codegen/syntax';
import { RCode, Assignment } from '../r-codegen/types';
import { RService } from '../services/r.service';
import { RResult } from '../models/r.model';
import { DialogBuilder } from './builders/types';

@Injectable()
export class DialogRCodeManager {
  // RSyntax state
  private readonly _syntax = signal<RSyntax | null>(null);

  // Builder function that constructs RSyntax from current dialog state
  private readonly _builder = signal<DialogBuilder | null>(null);

  // Assignment configuration
  private readonly _assignment = signal<Assignment | null>(null);

  // Read-only public API
  readonly syntax = this._syntax.asReadonly();
  readonly code = computed(() => {
    const syntax = this._syntax();
    return syntax ? syntax.toScript() : '';
  });

  /**
   * Initialize the code manager with a builder function
   *
   * The builder function is called whenever rebuild() is invoked.
   * It should return an RSyntax instance based on current dialog state.
   *
   * @param builder - DialogBuilder function that builds RSyntax from dialog state
   */
  initialize(builder: DialogBuilder): void {
    this._builder.set(builder);
    this.rebuild();
  }

  /**
   * Rebuild RSyntax by calling the builder function
   *
   * This should be called whenever dialog state changes that affect
   * R code generation. The builder function is called, and the resulting
   * RSyntax is stored with any configured assignment.
   */
  rebuild(): void {
    const builder = this._builder();
    if (!builder) {
      this._syntax.set(null);
      return;
    }

    let syntax = builder();
    const assignment = this._assignment();

    // Apply assignment if configured
    if (assignment) {
      syntax = syntax.setAssignment(assignment);
    }

    this._syntax.set(syntax);
  }

  /**
   * Set assignment configuration
   *
   * Assignment determines where the output of the R code goes
   * (e.g., 'graph', 'column', 'dataframe', 'model', 'table').
   *
   * @param assignment - Assignment configuration
   */
  setAssignment(assignment: Assignment | null): void {
    this._assignment.set(assignment);
    this.rebuild();
  }

  /**
   * Add code to run before the base code
   *
   * @param code - R code to add
   * @param position - Position for ordering (-1 = end)
   */
  addBefore(code: RCode, position: number = -1): void {
    const current = this._syntax();
    if (current) {
      this._syntax.set(current.addBefore(code, position));
    }
  }

  /**
   * Add code to run after the base code
   *
   * @param code - R code to add
   * @param position - Position for ordering (-1 = end)
   */
  addAfter(code: RCode, position: number = -1): void {
    const current = this._syntax();
    if (current) {
      this._syntax.set(current.addAfter(code, position));
    }
  }

  /**
   * Execute the current R code
   *
   * Generates the script from RSyntax and executes it via RService.
   *
   * @param rService - R service instance for execution
   * @returns Promise resolving to execution result
   */
  async execute(rService: RService): Promise<RResult> {
    const script = this.code();
    if (!script || script.trim().startsWith('#')) {
      return {
        success: false,
        error: 'No valid R code to execute',
      };
    }

    return await rService.execute(script);
  }

  /**
   * Get the current RSyntax instance
   */
  getSyntax(): RSyntax | null {
    return this._syntax();
  }

  /**
   * Reset the code manager (clear all state)
   */
  reset(): void {
    this._syntax.set(null);
    this._builder.set(null);
    this._assignment.set(null);
  }
}
