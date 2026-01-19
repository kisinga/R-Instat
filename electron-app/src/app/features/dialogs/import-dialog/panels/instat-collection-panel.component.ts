import { Component, OnInit, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RService } from '../../../../core/services/r.service';
import { ToastService } from '../../../../core/services/toast.service';

interface CollectionDataset {
  name: string;
  filename: string;
  path: string;
  title: string;
  format: string;
}

@Component({
  selector: 'app-instat-collection-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sub-panel-content">
      @if (isLoadingList()) {
        <div class="dataset-list-container flex-1 flex items-center justify-center">
          <span class="loading loading-spinner loading-md text-primary"></span>
        </div>
      } @else if (datasets().length === 0) {
        <div class="dataset-list-container flex-1 flex flex-col items-center justify-center text-base-content/50">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
          <p class="text-sm font-medium mb-1">No Datasets Found</p>
          <p class="text-xs text-center max-w-[240px]">
            Add data files (.rds, .csv, .xlsx) to the instat-collection folder.
          </p>
        </div>
      } @else {
        <!-- Dataset List Header -->
        <div class="form-group">
          <label class="form-label text-sm flex items-center justify-between">
            <span>Available Datasets</span>
            <span class="badge badge-sm badge-ghost">{{ datasets().length }}</span>
          </label>
        </div>

        <!-- Dataset List -->
        <div class="dataset-list-container flex-1 overflow-y-auto">
          <table class="table table-xs w-full">
            <thead class="sticky top-0 bg-base-200 z-10">
              <tr>
                <th class="text-xs font-medium">Name</th>
                <th class="w-16 text-xs font-medium text-right">Format</th>
              </tr>
            </thead>
            <tbody>
              @for (ds of datasets(); track ds.path) {
                <tr 
                  class="cursor-pointer transition-colors duration-100"
                  [class.selected-row]="isSelected(ds)"
                  (click)="selectDataset(ds)"
                >
                  <td>
                    <div class="font-medium text-sm">{{ ds.title }}</div>
                    <div class="text-xs text-base-content/50">{{ ds.filename }}</div>
                  </td>
                  <td class="text-right">
                    <span class="badge badge-sm" [class]="getFormatBadgeClass(ds.format)">
                      {{ ds.format.toUpperCase() }}
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Selected Info & Actions -->
      <div class="panel-actions">
        <div class="flex-1 min-w-0">
          @if (selectedDataset()) {
            <div class="selected-info">
              <span class="text-xs text-base-content/60">Selected:</span>
              <span class="text-sm truncate">{{ selectedDataset()!.title }}</span>
            </div>
          }
        </div>
        <button 
          class="btn btn-primary btn-sm" 
          (click)="loadDataset()"
          [disabled]="!selectedDataset() || isLoading() || datasets().length === 0"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-xs"></span>
          }
          Load Dataset
        </button>
      </div>
    </div>
  `,
  styles: [`
    .sub-panel-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 280px;
    }

    .form-group {
      margin-bottom: 0.5rem;
    }

    .dataset-list-container {
      height: 200px;
      border: 1px solid oklch(var(--bc) / 0.1);
      border-radius: 0.5rem;
      background: oklch(var(--b2) / 0.3);
    }

    .selected-row {
      background-color: oklch(var(--p) / 0.15) !important;
    }

    .selected-row td {
      color: oklch(var(--p));
    }

    .selected-row .badge {
      opacity: 0.8;
    }

    .panel-actions {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding-top: 0.75rem;
      margin-top: auto;
      border-top: 1px solid oklch(var(--bc) / 0.1);
    }

    .selected-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.25rem 0.5rem;
      background: oklch(var(--p) / 0.1);
      border-radius: 0.375rem;
      overflow: hidden;
    }
  `]
})
export class InstatCollectionPanelComponent implements OnInit {
  @Output() imported = new EventEmitter<void>();

  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);

  datasets = signal<CollectionDataset[]>([]);
  selectedDataset = signal<CollectionDataset | null>(null);
  isLoadingList = signal(false);
  isLoading = signal(false);

  async ngOnInit(): Promise<void> {
    await this.loadDatasetList();
  }

  async loadDatasetList(): Promise<void> {
    if (!window.electronAPI) {
      this.toastService.error('Electron API not available');
      return;
    }

    this.isLoadingList.set(true);
    try {
      const datasets = await window.electronAPI.r.listInstatCollection();
      this.datasets.set(datasets);
    } catch (error) {
      console.error('Failed to load Instat collection:', error);
      this.toastService.error('Failed to load Instat collection');
    } finally {
      this.isLoadingList.set(false);
    }
  }

  selectDataset(ds: CollectionDataset): void {
    this.selectedDataset.set(ds);
  }

  isSelected(ds: CollectionDataset): boolean {
    const selected = this.selectedDataset();
    return selected !== null && selected.path === ds.path;
  }

  getFormatBadgeClass(format: string): string {
    switch (format.toLowerCase()) {
      case 'rds': return 'badge-primary';
      case 'csv': return 'badge-success';
      case 'xlsx':
      case 'xls': return 'badge-warning';
      default: return 'badge-ghost';
    }
  }

  async loadDataset(): Promise<void> {
    const ds = this.selectedDataset();
    if (!ds || !window.electronAPI) return;

    this.isLoading.set(true);
    try {
      const result = await window.electronAPI.r.loadInstatCollectionDataset(ds.name, ds.path);
      
      if (result.success) {
        this.toastService.success(`Loaded ${ds.title}`);
        await this.rService.refreshDataframes();
        this.imported.emit();
      } else {
        this.toastService.error(result.error || 'Failed to load dataset');
      }
    } catch (error) {
      console.error('Failed to load dataset:', error);
      this.toastService.error(
        error instanceof Error ? error.message : 'Failed to load dataset'
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
