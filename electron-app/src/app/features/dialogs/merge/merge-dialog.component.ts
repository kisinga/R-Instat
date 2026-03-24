import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';
import { ColumnInfo } from '../../../core/models/r.model';
import { rSyntax } from '../../../core/r-codegen';

interface JoinType {
  id: string;
  name: string;
  description: string;
}

const JOIN_TYPES: JoinType[] = [
  { id: 'full_join', name: 'Full Join', description: 'Include all rows from both dataframes' },
  { id: 'left_join', name: 'Left Join', description: 'Include all rows from first dataframe' },
  { id: 'right_join', name: 'Right Join', description: 'Include all rows from second dataframe' },
  { id: 'inner_join', name: 'Inner Join', description: 'Include only matching rows' },
  { id: 'semi_join', name: 'Semi Join', description: 'Keep rows from first with match in second' },
  { id: 'anti_join', name: 'Anti Join', description: 'Keep rows from first without match in second' },
];

@Component({
  selector: 'app-merge-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="dialog-content merge-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'MERGE.TITLE' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
      </div>

      <div class="dialog-body">
        @if (dataframes().length < 2) {
          <div class="alert alert-warning">
            <span>{{ 'MERGE.NEED_TWO_DATAFRAMES' | translate }}</span>
          </div>
        } @else {
          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label class="form-label">{{ 'MERGE.FIRST_DATAFRAME' | translate }}</label>
              <select
                class="select select-bordered w-full select-sm"
                [ngModel]="selectedDataframe()"
                (ngModelChange)="onFirstDataframeChange($event)"
              >
                @for (df of dataframes(); track df) {
                  <option [value]="df" [disabled]="df === secondDataframe()">{{ df }}</option>
                }
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">{{ 'MERGE.SECOND_DATAFRAME' | translate }}</label>
              <select
                class="select select-bordered w-full select-sm"
                [ngModel]="secondDataframe()"
                (ngModelChange)="onSecondDataframeChange($event)"
              >
                @for (df of dataframes(); track df) {
                  <option [value]="df" [disabled]="df === selectedDataframe()">{{ df }}</option>
                }
              </select>
            </div>
          </div>

          <div class="form-group mt-4">
            <label class="form-label">{{ 'MERGE.JOIN_TYPE' | translate }}</label>
            <select class="select select-bordered w-full" [ngModel]="joinType()" (ngModelChange)="joinType.set($event)">
              @for (type of joinTypes; track type.id) {
                <option [value]="type.id">{{ type.name }} - {{ type.description }}</option>
              }
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4 mt-4">
            <div class="form-group">
              <label class="form-label">{{ 'MERGE.JOIN_COLUMN_1' | translate }}</label>
              <select class="select select-bordered w-full select-sm" [ngModel]="joinColumn1()" (ngModelChange)="joinColumn1.set($event)">
                <option value="">-- {{ 'MERGE.SELECT_COLUMN' | translate }} --</option>
                @for (col of firstColumns(); track col.name) {
                  <option [value]="col.name">{{ col.name }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">{{ 'MERGE.JOIN_COLUMN_2' | translate }}</label>
              <select class="select select-bordered w-full select-sm" [ngModel]="joinColumn2()" (ngModelChange)="joinColumn2.set($event)">
                <option value="">-- {{ 'MERGE.SELECT_COLUMN' | translate }} --</option>
                @for (col of secondColumns(); track col.name) {
                  <option [value]="col.name">{{ col.name }}</option>
                }
              </select>
            </div>
          </div>

          <div class="form-group mt-4">
            <label class="form-label">{{ 'MERGE.RESULT_NAME' | translate }}</label>
            <input
              type="text"
              class="input input-bordered w-full"
              [ngModel]="resultName()"
              (ngModelChange)="resultName.set($event)"
              placeholder="merged_data"
            />
          </div>

          <div class="code-preview-section mt-4">
            <button class="btn btn-ghost btn-xs gap-1" (click)="toggleCodePreview()">
              {{ showCodePreview() ? ('DIALOG.HIDE_CODE' | translate) : ('DIALOG.SHOW_CODE' | translate) }}
            </button>
            @if (showCodePreview()) {
              <pre class="code-block mt-2">{{ rCode() }}</pre>
            }
          </div>
        }
      </div>

      <div class="dialog-footer">
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="cancel()">{{ 'DIALOG.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="execute()" [disabled]="!isValid() || isLoading()">
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          {{ 'DIALOG.OK' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .merge-dialog { width: 600px; max-width: 90vw; }
    .code-block {
      background: hsl(var(--b2));
      border-radius: 0.5rem;
      padding: 0.75rem;
      font-family: monospace;
      font-size: 0.75rem;
      overflow-x: auto;
      max-height: 120px;
      white-space: pre-wrap;
    }
    .code-preview-section { border-top: 1px solid hsl(var(--b3)); padding-top: 0.75rem; }
  `],
})
export class MergeDialogComponent extends DialogBase implements OnInit {
  static { AIDialogClassRegistry.register(MergeDialogComponent); }
  static readonly dialogId = 'merge';
  readonly dialogTitle = 'Merge';

  secondDataframe = signal('');
  firstColumns = signal<ColumnInfo[]>([]);
  secondColumns = signal<ColumnInfo[]>([]);
  joinType = signal('left_join');
  joinColumn1 = signal('');
  joinColumn2 = signal('');
  resultName = signal('merged_data');

  readonly joinTypes = JOIN_TYPES;

  override ngOnInit(): void {
    super.ngOnInit();

    this.registerFormFields({
      secondDataframe: this.secondDataframe,
      joinType: this.joinType,
      joinColumn1: this.joinColumn1,
      joinColumn2: this.joinColumn2,
      resultName: this.resultName,
    });

    this.initializeCodeManager(() => rSyntax().setBase(this.buildMergeCode()));

    this.createEffect(() => {
      this.columns();
      this.firstColumns.set(this.columns());
    });

    this.createEffect(() => {
      this.selectedDataframe();
      this.secondDataframe();
      this.joinType();
      this.joinColumn1();
      this.joinColumn2();
      this.resultName();
      this.rebuildRCode();
    });

    const dfs = this.dataframes();
    if (dfs.length >= 2 && !this.secondDataframe()) {
      const first = this.selectedDataframe() || dfs[0];
      const second = dfs.find((df) => df !== first) ?? '';
      this.secondDataframe.set(second);
      void this.loadSecondColumns();
    }
  }

  async onFirstDataframeChange(name: string): Promise<void> {
    await this.onDataframeChange(name);
    this.joinColumn1.set('');
    this.ensureDistinctDataframes();
    await this.loadSecondColumns();
  }

  async onSecondDataframeChange(name: string): Promise<void> {
    this.secondDataframe.set(name);
    this.joinColumn2.set('');
    this.ensureDistinctDataframes();
    await this.loadSecondColumns();
  }

  protected override onDataframeChanged(): void {
    this.joinColumn1.set('');
    this.firstColumns.set(this.columns());
    this.ensureDistinctDataframes();
    void this.loadSecondColumns();
  }

  private async loadSecondColumns(): Promise<void> {
    if (!this.secondDataframe()) {
      this.secondColumns.set([]);
      return;
    }
    try {
      this.secondColumns.set(await this.rService.getColumnInfo(this.secondDataframe()));
    } catch {
      this.secondColumns.set([]);
    }
  }

  private ensureDistinctDataframes(): void {
    const first = this.selectedDataframe();
    const second = this.secondDataframe();
    if (first && second && first === second) {
      this.secondDataframe.set(this.dataframes().find((df) => df !== first) ?? '');
    }
  }

  isValid(): boolean {
    return !!(
      this.selectedDataframe() &&
      this.secondDataframe() &&
      this.selectedDataframe() !== this.secondDataframe() &&
      this.resultName().trim()
    );
  }

  private buildMergeCode(): string {
    if (!this.selectedDataframe() || !this.secondDataframe()) {
      return '# Select two dataframes';
    }

    const outputName = this.resultName().trim() || 'merged_data';
    let code = `${outputName} <- dplyr::${this.joinType()}(\n`;
    code += `  get_dataframe("${this.selectedDataframe()}"),\n`;
    code += `  get_dataframe("${this.secondDataframe()}")`;

    if (this.joinColumn1() && this.joinColumn2()) {
      if (this.joinColumn1() === this.joinColumn2()) {
        code += `,\n  by = "${this.joinColumn1()}"`;
      } else {
        code += `,\n  by = c("${this.joinColumn1()}" = "${this.joinColumn2()}")`;
      }
    }

    code += '\n)\n';
    code += `add_dataframe(name = "${outputName}", df = ${outputName})`;
    return code;
  }
}
