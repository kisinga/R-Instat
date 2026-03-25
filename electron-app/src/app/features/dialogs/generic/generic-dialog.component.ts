/**
 * GenericDialogComponent — Shell for spec-driven dialogs
 *
 * Renders a complete dialog from an OperationSpec:
 * - Chrome: header, footer with OK/Cancel/Show Code
 * - Dataframe selector (always first, convention from all existing dialogs)
 * - Form body: delegates to GenericFormSectionComponent
 * - R code generation via compileStepToR
 * - Save/restore preferences, AI registration, state restoration
 *
 * Uses composition (not inheritance from DialogBase) to avoid modifying
 * the abstract base class that serves 28 existing custom dialogs.
 *
 * Template architecture is composable:
 * - Shell owns chrome + lifecycle
 * - GenericFormSectionComponent renders param lists
 * - GenericFieldComponent renders individual controls
 * Future extensions (steps, subpaths) add to the shell without rewriting sections.
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AppStateService } from '../../../core/services/app-state.service';
import { RService } from '../../../core/services/r.service';
import { ToastService } from '../../../core/services/toast.service';
import { DialogRestoreService } from '../../../core/services/dialog-restore.service';
import { CurrentDialogueRegistryService } from '../../../core/ai/current-dialogue-registry.service';
import { buildDialogueAIContract } from '../../../core/ai/dialogue-ai-adapters';
import { validateDialogueAIContract } from '../../../core/ai/dialogue-contract-validator';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { GenericFormSectionComponent } from './sections/generic-form-section.component';
import { createParamSignals, collectState, applyState } from './utils/param-state';
import { isParamVisible } from './utils/param-visibility';
import { compileStepToR } from '../../../core/ai/step-to-r';
import type { OperationSpec } from '../../../core/ai/generic-dialog/operation-spec';
import type { DialogParamSchema } from '../../../core/ai/dialog-schema.registry';
import type { ColumnInfo } from '../../../core/models/r.model';
import type { WritableSignal } from '@angular/core';

@Component({
  selector: 'app-generic-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, GenericFormSectionComponent, CodePreviewComponent],
  template: `
    <div class="dialog-content" (click)="$event.stopPropagation()">

      <!-- Header -->
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ spec.title }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
      </div>

      <!-- Body -->
      <div class="dialog-body">

        <!-- Dataframe selector (always first) -->
        <div class="form-group">
          <label class="form-label">Data Frame <span class="text-error">*</span></label>
          <select class="select select-bordered w-full"
            [ngModel]="selectedDataframe()"
            (ngModelChange)="onDataframeChange($event)">
            @for (df of dataframes(); track df) {
              <option [value]="df">{{ df }}</option>
            }
          </select>
        </div>

        <!-- Form section: renders all non-dataframe params -->
        <app-generic-form-section
          [params]="nonDataframeParams"
          [state]="stateSignals"
          [columns]="columns()"
          [isVisible]="visibilityFn"
        />

        <!-- Code preview -->
        @if (showCodePreview()) {
          <div class="form-group mt-4">
            <app-code-preview
              [code]="generatedCode()"
              [collapsible]="false"
              [isValid]="isValid()"
            />
          </div>
        }
      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" (click)="toggleCodePreview()">
          {{ showCodePreview() ? 'Hide' : 'Show' }} Code
        </button>
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="cancel()">Cancel</button>
        <button class="btn btn-primary" (click)="execute()" [disabled]="!isValid() || isLoading()">
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          OK
        </button>
      </div>
    </div>
  `,
})
export class GenericDialogComponent implements OnInit, OnDestroy {
  @Input({ required: true }) spec!: OperationSpec;
  @Output() close = new EventEmitter<void>();

  private readonly appState = inject(AppStateService);
  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);
  private readonly dialogRestore = inject(DialogRestoreService);
  private readonly currentDialogueRegistry = inject(CurrentDialogueRegistryService);
  private readonly injector = inject(Injector);

  // Global state
  readonly dataframes = this.appState.dataframes;
  selectedDataframe = signal<string>('');
  columns = signal<ColumnInfo[]>([]);
  isLoading = signal(false);
  showCodePreview = signal(false);

  // Per-param state (created in ngOnInit from spec.params)
  stateSignals = new Map<string, WritableSignal<any>>();
  nonDataframeParams: DialogParamSchema[] = [];

  // Bound visibility function for the form section
  visibilityFn = (param: DialogParamSchema) => isParamVisible(param, this.stateSignals);

  // R code generation (reactive)
  generatedCode = signal('');

  private aiRegistered = false;

  ngOnInit(): void {
    // Build param signals
    this.nonDataframeParams = this.spec.params.filter((p) => p.kind !== 'dataframe');
    this.stateSignals = createParamSignals(this.spec.params);

    // Select active dataframe
    const dfs = this.dataframes();
    const active = this.appState.activeDataframe();
    if (active && dfs.includes(active)) {
      this.selectedDataframe.set(active);
    } else if (dfs.length > 0) {
      this.selectedDataframe.set(dfs[0]);
    }

    // Load columns
    if (this.selectedDataframe()) {
      this.loadColumns();
    }

    // Restore saved preferences
    const defaults = this.appState.getDialogDefaults<Record<string, unknown>>(this.spec.dialogId);
    if (defaults) {
      applyState(this.stateSignals, defaults);
    }

    // Check for AI restore data
    const restoreData = this.dialogRestore.getRestoreData();
    if (restoreData && restoreData.dialogId === this.spec.dialogId) {
      if (restoreData.state['dataframe']) {
        const df = restoreData.state['dataframe'] as string;
        if (this.dataframes().includes(df)) {
          this.selectedDataframe.set(df);
          this.loadColumns();
        }
      }
      applyState(this.stateSignals, restoreData.state);
      this.dialogRestore.clearRestoreData();
    }

    // Reactive R code rebuild
    runInInjectionContext(this.injector, () => {
      effect(() => {
        // Read all dependencies to trigger on any change
        const df = this.selectedDataframe();
        for (const sig of this.stateSignals.values()) {
          sig();
        }
        // Generate R code
        const state = collectState(this.stateSignals, df);
        this.generatedCode.set(compileStepToR(this.spec.dialogId, state) ?? '');
      });
    });

    // Register with AI
    this.registerWithAI();
  }

  ngOnDestroy(): void {
    if (this.aiRegistered) {
      this.currentDialogueRegistry.unregister(this.spec.dialogId);
    }
  }

  isValid(): boolean {
    if (!this.selectedDataframe()) return false;

    for (const param of this.spec.params) {
      if (param.kind === 'dataframe') continue;
      if (!isParamVisible(param, this.stateSignals)) continue;
      if (!param.required) continue;

      const sig = this.stateSignals.get(param.name);
      const value = sig?.();
      if (value === undefined || value === null || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
    }

    if (this.spec.validate) {
      const state = collectState(this.stateSignals, this.selectedDataframe());
      const error = this.spec.validate(state);
      if (error) return false;
    }

    return true;
  }

  async execute(): Promise<void> {
    if (!this.isValid()) {
      this.toastService.warning('Please fill in all required fields');
      return;
    }

    this.isLoading.set(true);
    try {
      const code = this.generatedCode();
      if (!code) {
        this.toastService.error('No R code generated');
        return;
      }

      const result = await this.rService.execute(code);
      if (!result.success) {
        this.toastService.error(result.error || 'R command failed');
        return;
      }

      // Save preferences
      const state = collectState(this.stateSignals, this.selectedDataframe());
      this.appState.saveDialogDefaults(this.spec.dialogId, state);

      this.toastService.success('Command executed successfully');
      this.close.emit();
    } catch (error) {
      this.toastService.error(
        error instanceof Error ? error.message : 'Failed to execute command'
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  async onDataframeChange(name: string): Promise<void> {
    this.selectedDataframe.set(name);
    await this.loadColumns();

    // Clear column selections that are no longer valid
    const availableNames = new Set(this.columns().map((c) => c.name));
    for (const param of this.nonDataframeParams) {
      if (param.kind === 'column') {
        const sig = this.stateSignals.get(param.name);
        if (sig && sig() && !availableNames.has(sig())) {
          sig.set('');
        }
      } else if (param.kind === 'column[]') {
        const sig = this.stateSignals.get(param.name);
        if (sig && Array.isArray(sig())) {
          sig.set(sig().filter((n: string) => availableNames.has(n)));
        }
      }
    }
  }

  toggleCodePreview(): void {
    this.showCodePreview.update((v) => !v);
  }

  cancel(): void {
    this.close.emit();
  }

  private async loadColumns(): Promise<void> {
    const df = this.selectedDataframe();
    if (!df) {
      this.columns.set([]);
      return;
    }
    try {
      const columnInfo = await this.rService.getColumnInfo(df);
      this.columns.set(columnInfo);
    } catch {
      this.columns.set([]);
    }
  }

  private registerWithAI(): void {
    const contract = buildDialogueAIContract({
      id: this.spec.dialogId,
      name: this.spec.title,
      description: this.spec.description,
      capabilities: ['provide-r-code'],
      getVariables: () => collectState(this.stateSignals, this.selectedDataframe()),
      getRCode: () => this.generatedCode(),
    });
    const { valid } = validateDialogueAIContract(contract);
    if (valid) {
      this.currentDialogueRegistry.register(this.spec.dialogId, contract);
      this.aiRegistered = true;
    }
  }
}
