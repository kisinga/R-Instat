import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';

@Component({
  selector: 'app-correlation-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent],
  template: `
    <div class="dialog-content" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ dialogTitle }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
      </div>

      <div class="dialog-body">
        <!-- Dataframe Selection -->
        <div class="form-group">
          <label class="form-label">Data Frame</label>
          <select 
            class="select select-bordered w-full"
            [ngModel]="selectedDataframe()"
            (ngModelChange)="onDataframeChange($event)"
          >
            @for (df of dataframes(); track df) {
              <option [value]="df">{{ df }}</option>
            }
          </select>
        </div>

        <!-- Variables -->
        <div class="form-group">
          <label class="form-label">Variables (select 2 or more numeric columns)</label>
          <app-column-picker
            [columns]="getNumericColumns()"
            [multiple]="true"
            [(selectedColumns)]="selectedVars"
          />
        </div>

        <!-- Method -->
        <div class="form-group">
          <label class="form-label">Correlation Method</label>
          <select class="select select-bordered w-full" [(ngModel)]="method">
            <option value="pearson">Pearson (linear)</option>
            <option value="spearman">Spearman (rank)</option>
            <option value="kendall">Kendall (rank)</option>
          </select>
        </div>

        <!-- Options -->
        <div class="form-group">
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-primary" [(ngModel)]="showPValues" />
            <span>Show p-values</span>
          </label>
        </div>

        <!-- Code Preview -->
        @if (showCodePreview()) {
          <div class="form-group mt-4">
            <label class="form-label">R Code Preview</label>
            <pre class="code-block">{{ buildRCode() }}</pre>
          </div>
        }
      </div>

      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" (click)="toggleCodePreview()">
          {{ showCodePreview() ? 'Hide' : 'Show' }} Code
        </button>
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="cancel()">Cancel</button>
        <button 
          class="btn btn-primary" 
          (click)="execute()"
          [disabled]="!isValid() || isLoading()"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          OK
        </button>
      </div>
    </div>
  `,
})
export class CorrelationDialogComponent extends DialogBase {
  readonly dialogTitle = 'Correlation Analysis';

  selectedVars: string[] = [];
  method = 'pearson';
  showPValues = true;

  buildRCode(): string {
    const df = this.selectedDataframe();
    if (!df) return '# Select a dataframe first';
    
    const vars = this.selectedVars;
    if (vars.length < 2) {
      return '# Select at least 2 variables';
    }

    const varsStr = vars.map(v => `"${v}"`).join(', ');

    if (this.showPValues) {
      return `# Correlation matrix with p-values
cor_data <- get_dataframe("${df}") %>%
  dplyr::select(${varsStr})

# Correlation coefficients
cor_matrix <- cor(cor_data, use = "pairwise.complete.obs", method = "${this.method}")
print("Correlation Matrix:")
print(round(cor_matrix, 3))

# P-values using cor.test
cat("\\nP-values:\\n")
n <- ncol(cor_data)
p_matrix <- matrix(NA, n, n)
colnames(p_matrix) <- rownames(p_matrix) <- names(cor_data)
for (i in 1:(n-1)) {
  for (j in (i+1):n) {
    test <- cor.test(cor_data[[i]], cor_data[[j]], method = "${this.method}")
    p_matrix[i,j] <- p_matrix[j,i] <- test$p.value
  }
}
print(round(p_matrix, 4))`;
    }

    return `# Correlation matrix
cor_data <- get_dataframe("${df}") %>%
  dplyr::select(${varsStr})

cor_matrix <- cor(cor_data, use = "pairwise.complete.obs", method = "${this.method}")
print(round(cor_matrix, 3))`;
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && this.selectedVars.length >= 2;
  }
}
