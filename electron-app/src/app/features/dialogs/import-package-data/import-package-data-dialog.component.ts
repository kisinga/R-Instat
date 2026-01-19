import { Component, OnInit, inject, signal, computed, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RService } from '../../../core/services/r.service';
import { ToastService } from '../../../core/services/toast.service';

interface PackageDataset {
  package: string;
  name: string;
  title: string;
}

@Component({
  selector: 'app-import-package-data-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dialog-content w-[700px]" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ dialogTitle }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
      </div>

      <div class="dialog-body">
        <!-- Search -->
        <div class="form-group">
          <label class="form-label">Search Datasets</label>
          <input
            type="text"
            class="input input-bordered w-full"
            placeholder="Search by name, package, or description..."
            [(ngModel)]="searchQuery"
          />
        </div>

        <!-- Dataset List -->
        <div class="form-group">
          <label class="form-label">
            Available Datasets 
            <span class="badge badge-sm badge-ghost ml-2">
              {{ filteredDatasets().length }} of {{ datasets().length }}
            </span>
          </label>
          
          @if (isLoadingList()) {
            <div class="flex items-center justify-center py-8">
              <span class="loading loading-spinner loading-lg text-primary"></span>
            </div>
          } @else if (datasets().length === 0) {
            <div class="text-center py-8 text-base-content/50">
              <p>No datasets found</p>
              <p class="text-sm">Make sure R packages are installed</p>
            </div>
          } @else {
            <div class="max-h-80 overflow-y-auto border border-base-300 rounded-lg">
              <table class="table table-xs table-zebra w-full">
                <thead class="sticky top-0 bg-base-200">
                  <tr>
                    <th class="w-28">Package</th>
                    <th class="w-32">Dataset</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  @for (ds of filteredDatasets(); track ds.package + ds.name) {
                    <tr 
                      class="cursor-pointer hover:bg-primary/10"
                      [class.selected-row]="isSelected(ds)"
                      (click)="selectDataset(ds)"
                    >
                      <td class="font-mono text-xs">{{ ds.package }}</td>
                      <td class="font-medium">{{ ds.name }}</td>
                      <td class="text-xs text-base-content/70 truncate max-w-xs" [title]="ds.title">
                        {{ ds.title }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <!-- Selected Dataset Info -->
        @if (selectedDataset()) {
          <div class="form-group">
            <div class="alert alert-info">
              <div>
                <span class="font-medium">Selected:</span>
                <span class="font-mono">{{ selectedDataset()!.package }}::{{ selectedDataset()!.name }}</span>
              </div>
            </div>
          </div>
        }
      </div>

      <div class="dialog-footer">
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="cancel()">Cancel</button>
        <button 
          class="btn btn-primary" 
          (click)="loadDataset()"
          [disabled]="!selectedDataset() || isLoading()"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          Load Dataset
        </button>
      </div>
    </div>
  `,
  styles: [`
    .selected-row {
      background-color: oklch(var(--p) / 0.2);
    }
  `]
})
export class ImportPackageDataDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  readonly dialogTitle = 'Import from R Package';

  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);

  // State
  datasets = signal<PackageDataset[]>([]);
  selectedDataset = signal<PackageDataset | null>(null);
  searchQuery = '';
  isLoadingList = signal(false);
  isLoading = signal(false);

  // Filtered datasets based on search
  filteredDatasets = computed(() => {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) {
      return this.datasets();
    }

    return this.datasets().filter(ds =>
      ds.name.toLowerCase().includes(query) ||
      ds.package.toLowerCase().includes(query) ||
      ds.title.toLowerCase().includes(query)
    );
  });

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
      const datasets = await window.electronAPI.r.listPackageDatasets();
      this.datasets.set(datasets);
    } catch (error) {
      console.error('Failed to load package datasets:', error);
      this.toastService.error('Failed to load package datasets');
    } finally {
      this.isLoadingList.set(false);
    }
  }

  selectDataset(ds: PackageDataset): void {
    this.selectedDataset.set(ds);
  }

  isSelected(ds: PackageDataset): boolean {
    const selected = this.selectedDataset();
    return selected !== null && 
           selected.package === ds.package && 
           selected.name === ds.name;
  }

  async loadDataset(): Promise<void> {
    const ds = this.selectedDataset();
    if (!ds || !window.electronAPI) return;

    this.isLoading.set(true);
    try {
      const result = await window.electronAPI.r.loadPackageDataset(ds.package, ds.name);
      
      if (result.success) {
        this.toastService.success(`Loaded ${ds.name} from ${ds.package}`);
        await this.rService.refreshDataframes();
        this.close.emit();
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

  cancel(): void {
    this.close.emit();
  }
}
