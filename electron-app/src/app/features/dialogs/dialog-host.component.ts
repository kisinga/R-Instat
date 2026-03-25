import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { RService } from '../../core/services/r.service';
import { listDialogIds } from '../../core/ai/dialog-identity.registry';
import { getOperationSpec } from '../../core/ai/generic-dialog/operation-spec.registry';

// Import all dialog components
import { ImportDialogComponent } from './import-dialog/import-dialog.component';
import { SummaryDialogComponent } from './summary/summary-dialog.component';
import { HistogramDialogComponent } from './histogram/histogram-dialog.component';
import { BoxplotDialogComponent } from './boxplot/boxplot-dialog.component';
import { ScatterDialogComponent } from './scatter/scatter-dialog.component';
import { BarChartDialogComponent } from './bar-chart/bar-chart-dialog.component';
import { FilterDialogComponent } from './filter/filter-dialog.component';
import { SortDialogComponent } from './sort/sort-dialog.component';
import { CalculateDialogComponent } from './calculate/calculate-dialog.component';
import { RecodeDialogComponent } from './recode/recode-dialog.component';
import { RenameDialogComponent } from './rename/rename-dialog.component';
import { CorrelationDialogComponent } from './correlation/correlation-dialog.component';
import { TTestDialogComponent } from './t-test/t-test-dialog.component';
import { RegressionDialogComponent } from './regression/regression-dialog.component';
import { DescribeDialogComponent } from './describe/describe-dialog.component';

// Domain Expert dialogs
import { DomainSelectorComponent } from '../domain-expert/domain-selector.component';
import { DefineClimaticDataDialogComponent } from './climatic/define-climatic-data/define-climatic-data-dialog.component';
import { ClimaticSummaryDialogComponent } from './climatic/climatic-summary/climatic-summary-dialog.component';
import { InventoryPlotDialogComponent } from './climatic/inventory-plot/inventory-plot-dialog.component';
import { AnnualRainfallDialogComponent } from './climatic/annual-rainfall/annual-rainfall-dialog.component';
import { ExtremesDialogComponent } from './climatic/extremes/extremes-dialog.component';
import { DayCountDialogComponent } from './climatic/day-count/day-count-dialog.component';
import { SpellLengthsDialogComponent } from './climatic/spell-lengths/spell-lengths-dialog.component';
import { SeasonalSummaryDialogComponent } from './climatic/seasonal-summary/seasonal-summary-dialog.component';
import { MissingReportDialogComponent } from './climatic/missing-report/missing-report-dialog.component';
import { TemperatureSummaryDialogComponent } from './climatic/temperature-summary/temperature-summary-dialog.component';

// High Priority dialogs
import { ExportDialogComponent } from './export/export-dialog.component';
import { MergeDialogComponent } from './merge/merge-dialog.component';
import { StackDialogComponent } from './stack/stack-dialog.component';
import { UnstackDialogComponent } from './unstack/unstack-dialog.component';
import { LinePlotDialogComponent } from './line-plot/line-plot-dialog.component';
import { DotPlotDialogComponent } from './dot-plot/dot-plot-dialog.component';
import { RestoreFromCodeDialogComponent } from './restore-from-code/restore-from-code-dialog.component';
import { GenericDialogComponent } from './generic/generic-dialog.component';

// Import generic dialog specs (side-effect: registers them)
import '../../core/ai/generic-dialog/specs/duplicate-columns';
import '../../core/ai/generic-dialog/specs/permute-column';
import '../../core/ai/generic-dialog/specs/delete-columns';
import '../../core/ai/generic-dialog/specs/insert-column';
import { AiSettingsDialogComponent } from './ai-settings/ai-settings-dialog.component';
import { SettingsDialogComponent } from './settings/settings-dialog.component';

@Component({
  selector: 'app-dialog-host',
  standalone: true,
  imports: [
    CommonModule,
    ImportDialogComponent,
    SummaryDialogComponent,
    HistogramDialogComponent,
    BoxplotDialogComponent,
    ScatterDialogComponent,
    BarChartDialogComponent,
    FilterDialogComponent,
    SortDialogComponent,
    CalculateDialogComponent,
    RecodeDialogComponent,
    RenameDialogComponent,
    CorrelationDialogComponent,
    TTestDialogComponent,
    RegressionDialogComponent,
    DescribeDialogComponent,
    // Domain Expert dialogs
    DomainSelectorComponent,
    DefineClimaticDataDialogComponent,
    ClimaticSummaryDialogComponent,
    InventoryPlotDialogComponent,
    AnnualRainfallDialogComponent,
    ExtremesDialogComponent,
    DayCountDialogComponent,
    SpellLengthsDialogComponent,
    SeasonalSummaryDialogComponent,
    MissingReportDialogComponent,
    TemperatureSummaryDialogComponent,
    // High Priority dialogs
    ExportDialogComponent,
    MergeDialogComponent,
    StackDialogComponent,
    UnstackDialogComponent,
    LinePlotDialogComponent,
    DotPlotDialogComponent,
    RestoreFromCodeDialogComponent,
    AiSettingsDialogComponent,
    SettingsDialogComponent,
    GenericDialogComponent,
  ],
  template: `
    @if (activeDialog()) {
      <div class="dialog-overlay" (click)="onOverlayClick($event)">
        @switch (activeDialog()) {
          @case ('import') {
            <app-import-dialog (close)="closeDialog()" />
          }
          @case ('summary') {
            <app-summary-dialog (close)="closeDialog()" />
          }
          @case ('histogram') {
            <app-histogram-dialog (close)="closeDialog()" />
          }
          @case ('boxplot') {
            <app-boxplot-dialog (close)="closeDialog()" />
          }
          @case ('scatter') {
            <app-scatter-dialog (close)="closeDialog()" />
          }
          @case ('bar-chart') {
            <app-bar-chart-dialog (close)="closeDialog()" />
          }
          @case ('filter') {
            <app-filter-dialog (close)="closeDialog()" />
          }
          @case ('sort') {
            <app-sort-dialog (close)="closeDialog()" />
          }
          @case ('calculate') {
            <app-calculate-dialog (close)="closeDialog()" />
          }
          @case ('recode') {
            <app-recode-dialog (close)="closeDialog()" />
          }
          @case ('rename') {
            <app-rename-dialog (close)="closeDialog()" />
          }
          @case ('correlation') {
            <app-correlation-dialog (close)="closeDialog()" />
          }
          @case ('t-test') {
            <app-t-test-dialog (close)="closeDialog()" />
          }
          @case ('regression') {
            <app-regression-dialog (close)="closeDialog()" />
          }
          @case ('describe') {
            <app-describe-dialog [initialMode]="'describe'" (close)="closeDialog()" />
          }
          @case ('describe:summary') {
            <app-summary-dialog (close)="closeDialog()" />
          }
          @case ('describe:graph') {
            <app-describe-dialog [initialMode]="'describe:graph'" (close)="closeDialog()" />
          }
          @case ('domain-selector') {
            <app-domain-selector (close)="closeDialog()" />
          }
          @case ('climatic-summary') {
            <app-climatic-summary-dialog (close)="closeDialog()" />
          }
          @case ('inventory-plot') {
            <app-inventory-plot-dialog (close)="closeDialog()" />
          }
          @case ('define-climatic-data') {
            <app-define-climatic-data-dialog (close)="closeDialog()" />
          }
          @case ('annual-rainfall') {
            <app-annual-rainfall-dialog (close)="closeDialog()" />
          }
          @case ('extremes') {
            <app-extremes-dialog (close)="closeDialog()" />
          }
          @case ('day-count') {
            <app-day-count-dialog (close)="closeDialog()" />
          }
          @case ('spell-lengths') {
            <app-spell-lengths-dialog (close)="closeDialog()" />
          }
          @case ('seasonal-summary') {
            <app-seasonal-summary-dialog (close)="closeDialog()" />
          }
          @case ('missing-report') {
            <app-missing-report-dialog (close)="closeDialog()" />
          }
          @case ('temperature-summary') {
            <app-temperature-summary-dialog (close)="closeDialog()" />
          }
          @case ('export') {
            <app-export-dialog (close)="closeDialog()" />
          }
          @case ('merge') {
            <app-merge-dialog (close)="closeDialog()" />
          }
          @case ('stack') {
            <app-stack-dialog (close)="closeDialog()" />
          }
          @case ('unstack') {
            <app-unstack-dialog (close)="closeDialog()" />
          }
          @case ('line-plot') {
            <app-line-plot-dialog (close)="closeDialog()" />
          }
          @case ('dot-plot') {
            <app-dot-plot-dialog (close)="closeDialog()" />
          }
          @case ('restore-from-code') {
            <app-restore-from-code-dialog (close)="closeDialog()" />
          }
          @case ('ai-settings') {
            <app-ai-settings-dialog (close)="closeDialog()" />
          }
          @case ('settings') {
            <app-settings-dialog (close)="closeDialog()" />
          }
          @default {
            @if (resolvedSpec()) {
              <app-generic-dialog [spec]="resolvedSpec()!" (close)="closeDialog()" />
            }
          }
        }
      </div>
    }
  `,
})
export class DialogHostComponent implements OnInit, OnDestroy {
  private static readonly HOST_DIALOG_IDS = new Set(listDialogIds());

  private readonly rService = inject(RService);
  private subscription?: Subscription;

  activeDialog = signal<string | null>(null);

  /** Resolves the OperationSpec for the active dialog (if it's a generic dialog). */
  readonly resolvedSpec = computed(() => getOperationSpec(this.activeDialog() ?? ''));

  ngOnInit(): void {
    this.subscription = this.rService.dialog$.subscribe(({ action, dialog }) => {
      console.log('[DialogHost] Dialog action:', action, 'dialog:', dialog);
      if (action === 'open') {
        if (!DialogHostComponent.HOST_DIALOG_IDS.has(dialog)) {
          console.warn('[DialogHost] Unknown dialog id:', dialog);
          return;
        }
        this.activeDialog.set(dialog);
        console.log('[DialogHost] Active dialog set to:', dialog);
      } else if (action === 'close') {
        this.activeDialog.set(null);
        console.log('[DialogHost] Active dialog cleared');
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', this.handleKeydown);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    document.removeEventListener('keydown', this.handleKeydown);
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.activeDialog()) {
      this.closeDialog();
    }
  };

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('dialog-overlay')) {
      this.closeDialog();
    }
  }

  closeDialog(): void {
    this.activeDialog.set(null);
  }
}
