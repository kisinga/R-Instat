import { Component, OnInit, OnDestroy, inject, signal, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { RService } from '../../core/services/r.service';

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

// Dialog registry
const DIALOG_COMPONENTS: Record<string, Type<unknown>> = {
  'import': ImportDialogComponent,
  'summary': SummaryDialogComponent,
  'histogram': HistogramDialogComponent,
  'boxplot': BoxplotDialogComponent,
  'scatter': ScatterDialogComponent,
  'bar-chart': BarChartDialogComponent,
  'filter': FilterDialogComponent,
  'sort': SortDialogComponent,
  'calculate': CalculateDialogComponent,
  'recode': RecodeDialogComponent,
  'rename': RenameDialogComponent,
  'correlation': CorrelationDialogComponent,
  't-test': TTestDialogComponent,
  'regression': RegressionDialogComponent,
  'describe': DescribeDialogComponent,
  'describe:summary': DescribeDialogComponent,
  'describe:graph': DescribeDialogComponent,
};

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
            <app-describe-dialog [initialMode]="'describe:summary'" (close)="closeDialog()" />
          }
          @case ('describe:graph') {
            <app-describe-dialog [initialMode]="'describe:graph'" (close)="closeDialog()" />
          }
        }
      </div>
    }
  `,
})
export class DialogHostComponent implements OnInit, OnDestroy {
  private readonly rService = inject(RService);
  private subscription?: Subscription;

  activeDialog = signal<string | null>(null);

  ngOnInit(): void {
    this.subscription = this.rService.dialog$.subscribe(({ action, dialog }) => {
      if (action === 'open') {
        this.activeDialog.set(dialog);
      } else if (action === 'close') {
        this.activeDialog.set(null);
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
