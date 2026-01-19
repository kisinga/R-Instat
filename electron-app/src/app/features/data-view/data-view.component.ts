import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridReadyEvent, GridApi } from 'ag-grid-community';
import { RService } from '../../core/services/r.service';
import { ThemeService } from '../../core/services/theme.service';
import { mapRTypeToCategory, getColumnTypeIcon } from '../../core/models/r.model';

@Component({
  selector: 'app-data-view',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular],
  template: `
    <div class="h-full flex flex-col bg-base-100 overflow-hidden">
      <!-- Dataframe Tabs -->
      <div class="flex items-center border-b border-base-300 bg-base-200 px-2">
        <div class="flex items-center gap-1 overflow-x-auto py-1">
          @for (df of rService.dataframes(); track df) {
            <button
              class="tab-btn"
              [class.active]="df === rService.activeDataframe()"
              (click)="selectDataframe(df)"
            >
              {{ df }}
            </button>
          }
        </div>
        
        @if (rService.dataframes().length === 0) {
          <span class="text-sm text-base-content/50 py-2">No data loaded</span>
        }
      </div>

      <!-- Grid Container -->
      <div class="flex-1 min-h-0">
        @if (isLoading()) {
          <div class="h-full flex items-center justify-center">
            <span class="loading loading-spinner loading-lg text-primary"></span>
          </div>
        } @else if (rowData().length > 0) {
          <ag-grid-angular
            style="width: 100%; height: 100%;"
            [class]="gridTheme()"
            [rowData]="rowData()"
            [columnDefs]="columnDefs()"
            [defaultColDef]="defaultColDef"
            [animateRows]="true"
            [suppressCellFocus]="true"
            [enableCellTextSelection]="true"
            [ensureDomOrder]="true"
            (gridReady)="onGridReady($event)"
          />
        } @else if (rService.activeDataframe()) {
          <div class="h-full flex items-center justify-center text-base-content/50">
            <p>No data to display</p>
          </div>
        } @else {
          <div class="h-full flex items-center justify-center text-base-content/50">
            <p>Select a dataframe or import data to begin</p>
          </div>
        }
      </div>

      <!-- Footer with pagination -->
      @if (totalRows() > 0) {
        <div class="px-3 py-1.5 bg-base-200 border-t border-base-300 text-xs flex items-center justify-between gap-4">
          <!-- Row count -->
          <span class="text-base-content/70">
            {{ totalRows() | number }} rows × {{ columnDefs().length }} columns
          </span>

          <!-- Pagination controls -->
          <div class="flex items-center gap-2">
            <!-- Page size selector -->
            <select 
              class="select select-xs select-bordered w-20"
              [value]="pageSize()"
              (change)="changePageSize(+$any($event.target).value)"
            >
              @for (size of pageSizeOptions; track size) {
                <option [value]="size">{{ size }}</option>
              }
            </select>
            <span class="text-base-content/50">per page</span>

            <!-- Page navigation -->
            <div class="join">
              <button 
                class="join-item btn btn-xs"
                [disabled]="!canGoPrev()"
                (click)="firstPage()"
                title="First page"
              >«</button>
              <button 
                class="join-item btn btn-xs"
                [disabled]="!canGoPrev()"
                (click)="prevPage()"
                title="Previous page"
              >‹</button>
              <span class="join-item btn btn-xs btn-disabled no-animation">
                {{ startRow() | number }}-{{ endRow() | number }} of {{ totalRows() | number }}
              </span>
              <button 
                class="join-item btn btn-xs"
                [disabled]="!canGoNext()"
                (click)="nextPage()"
                title="Next page"
              >›</button>
              <button 
                class="join-item btn btn-xs"
                [disabled]="!canGoNext()"
                (click)="lastPage()"
                title="Last page"
              >»</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .tab-btn {
      @apply px-3 py-1.5 text-sm rounded-t border-b-2 border-transparent 
             text-base-content/70 hover:text-base-content hover:bg-base-300 transition-colors;
    }

    .tab-btn.active {
      @apply text-primary border-primary bg-base-100 font-medium;
    }
  `]
})
export class DataViewComponent implements OnInit, OnDestroy {
  readonly rService = inject(RService);
  private readonly themeService = inject(ThemeService);
  private subscriptions: Subscription[] = [];
  private gridApi?: GridApi;

  // Data state
  isLoading = signal(false);
  rowData = signal<Record<string, unknown>[]>([]);
  columnDefs = signal<ColDef[]>([]);
  totalRows = signal(0);

  // Pagination state
  currentPage = signal(1);
  pageSize = signal(100);
  readonly pageSizeOptions = [50, 100, 250, 500];

  // Computed pagination info
  totalPages = computed(() => Math.ceil(this.totalRows() / this.pageSize()) || 1);
  startRow = computed(() => (this.currentPage() - 1) * this.pageSize() + 1);
  endRow = computed(() => Math.min(this.currentPage() * this.pageSize(), this.totalRows()));
  canGoPrev = computed(() => this.currentPage() > 1);
  canGoNext = computed(() => this.currentPage() < this.totalPages());

  gridTheme = computed(() => 
    this.themeService.isDark() ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'
  );

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    minWidth: 100,
  };

  ngOnInit(): void {
    // Load data when active dataframe changes
    const sub = this.rService.onDataRefresh$.subscribe(() => {
      this.loadData();
    });
    this.subscriptions.push(sub);

    // Initial load if there's an active dataframe
    if (this.rService.activeDataframe()) {
      this.loadData();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  selectDataframe(name: string): void {
    this.rService.setActiveDataframe(name);
    this.currentPage.set(1); // Reset to first page
    this.loadData();
  }

  async loadData(): Promise<void> {
    const dfName = this.rService.activeDataframe();
    if (!dfName) {
      this.rowData.set([]);
      this.columnDefs.set([]);
      this.totalRows.set(0);
      return;
    }

    this.isLoading.set(true);
    try {
      const offset = (this.currentPage() - 1) * this.pageSize();
      const preview = await this.rService.getDataPreview(dfName, this.pageSize(), offset);
      
      // Build column definitions with type indicators
      const colDefs: ColDef[] = preview.columns.map(col => {
        const rType = preview.columnTypes[col] || 'unknown';
        const category = mapRTypeToCategory(rType);
        const icon = getColumnTypeIcon(category);
        
        return {
          field: col,
          headerName: `${icon} ${col}`,
          headerTooltip: `${col} (${rType})`,
          cellClass: `col-type-${category}`,
        };
      });

      // Convert rows to flat objects
      const rows = preview.rows.map(row => {
        const flatRow: Record<string, unknown> = {};
        for (const col of preview.columns) {
          flatRow[col] = (row as Record<string, unknown>)[col];
        }
        return flatRow;
      });

      this.columnDefs.set(colDefs);
      this.rowData.set(rows);
      this.totalRows.set(preview.totalRows);
    } catch (error) {
      console.error('Failed to load data:', error);
      this.rowData.set([]);
      this.columnDefs.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  // Pagination methods
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadData();
    }
  }

  prevPage(): void {
    if (this.canGoPrev()) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.canGoNext()) {
      this.goToPage(this.currentPage() + 1);
    }
  }

  firstPage(): void {
    this.goToPage(1);
  }

  lastPage(): void {
    this.goToPage(this.totalPages());
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1); // Reset to first page
    this.loadData();
  }

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
    event.api.sizeColumnsToFit();
  }
}
