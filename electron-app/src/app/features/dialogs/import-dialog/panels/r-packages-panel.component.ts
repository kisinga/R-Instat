import { Component, OnInit, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RService } from '../../../../core/services/r.service';
import { ToastService } from '../../../../core/services/toast.service';

interface PackageDataset {
  package: string;
  name: string;
  title: string;
}

@Component({
  selector: 'app-r-packages-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sub-panel-content">
      <!-- Search -->
      <div class="form-group">
        <div class="relative">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            class="input input-bordered input-sm w-full pl-9"
            placeholder="Search by package or dataset name..."
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
          />
          @if (searchQuery()) {
            <button 
              class="btn btn-ghost btn-xs btn-circle absolute right-2 top-1/2 -translate-y-1/2"
              (click)="searchQuery.set('')"
            >✕</button>
          }
        </div>
      </div>

      <!-- Dataset List -->
      <div class="form-group flex-1">
        <label class="form-label text-sm flex items-center justify-between">
          <span>Available Datasets</span>
          <span class="badge badge-sm badge-ghost">
            {{ filteredDatasets().length }} of {{ datasets().length }}
          </span>
        </label>
        
        @if (isLoadingList()) {
          <div class="dataset-list-container flex items-center justify-center">
            <span class="loading loading-spinner loading-md text-primary"></span>
          </div>
        } @else if (datasets().length === 0) {
          <div class="dataset-list-container flex flex-col items-center justify-center text-base-content/50">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p class="text-sm">No datasets found</p>
            <p class="text-xs">Make sure R packages are installed</p>
          </div>
        } @else if (filteredDatasets().length === 0) {
          <div class="dataset-list-container flex flex-col items-center justify-center text-base-content/50">
            <p class="text-sm">No matches for "{{ searchQuery() }}"</p>
          </div>
        } @else {
          <div class="dataset-list-container overflow-y-auto">
            <table class="table table-xs table-zebra w-full">
              <thead class="sticky top-0 bg-base-200 z-10">
                <tr>
                  <th class="w-24 text-xs font-medium">Package</th>
                  <th class="w-28 text-xs font-medium">Dataset</th>
                  <th class="text-xs font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                @for (ds of filteredDatasets(); track ds.package + ds.name) {
                  <tr 
                    class="cursor-pointer transition-colors duration-100"
                    [class.selected-row]="isSelected(ds)"
                    (click)="selectDataset(ds)"
                  >
                    <td class="font-mono text-xs text-base-content/70">{{ ds.package }}</td>
                    <td class="font-medium text-sm">{{ ds.name }}</td>
                    <td class="text-xs text-base-content/60 truncate max-w-[200px]" [title]="ds.title">
                      {{ ds.title }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- Selected Info & Actions -->
      <div class="panel-actions">
        <div class="flex-1 min-w-0">
          @if (selectedDataset()) {
            <div class="selected-info">
              <span class="text-xs text-base-content/60">Selected:</span>
              <span class="font-mono text-sm truncate">{{ selectedDataset()!.package }}::{{ selectedDataset()!.name }}</span>
            </div>
          }
        </div>
        <button 
          class="btn btn-primary btn-sm" 
          (click)="loadDataset()"
          [disabled]="!selectedDataset() || isLoading()"
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
      margin-bottom: 0.75rem;
    }

    .dataset-list-container {
      height: 180px;
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
export class RPackagesPanelComponent implements OnInit {
  @Output() imported = new EventEmitter<void>();

  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);

  datasets = signal<PackageDataset[]>([]);
  selectedDataset = signal<PackageDataset | null>(null);
  searchQuery = signal('');
  isLoadingList = signal(false);
  isLoading = signal(false);

  filteredDatasets = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
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
