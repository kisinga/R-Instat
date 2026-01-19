import { Component, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ImportFilePanelComponent } from './panels/import-file-panel.component';
import { ImportLibraryPanelComponent } from './panels/import-library-panel.component';

type ImportTab = 'file' | 'library';

@Component({
  selector: 'app-import-dialog',
  standalone: true,
  imports: [CommonModule, ImportFilePanelComponent, ImportLibraryPanelComponent],
  template: `
    <div class="dialog-content w-[720px]" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">Import Data</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="close.emit()">✕</button>
      </div>

      <!-- Tabs -->
      <div class="tabs-container">
        <div role="tablist" class="tabs tabs-boxed bg-base-200/50 p-1 gap-1">
          <button 
            role="tab" 
            class="tab transition-all duration-200"
            [class.tab-active]="activeTab() === 'file'"
            (click)="switchTab('file')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            From File
          </button>
          <button 
            role="tab" 
            class="tab transition-all duration-200"
            [class.tab-active]="activeTab() === 'library'"
            (click)="switchTab('library')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
            From Library
          </button>
        </div>
      </div>

      <!-- Panel Container with fixed height -->
      <div class="panel-container">
        <div 
          class="panel-wrapper"
          [class.fade-out]="isTransitioning()"
          [class.fade-in]="!isTransitioning()"
        >
          @switch (activeTab()) {
            @case ('file') {
              <app-import-file-panel (imported)="close.emit()" />
            }
            @case ('library') {
              <app-import-library-panel (imported)="close.emit()" />
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tabs-container {
      padding: 0.75rem 1.5rem 0;
    }

    .tabs-boxed {
      border-radius: 0.75rem;
    }

    .tab {
      flex: 1;
      border-radius: 0.5rem;
      font-weight: 500;
      font-size: 0.875rem;
    }

    .tab-active {
      background-color: oklch(var(--b1));
      box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
    }

    .panel-container {
      min-height: 420px;
      max-height: 480px;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .panel-wrapper {
      padding: 1.25rem 1.5rem 1.5rem;
      transition: opacity 150ms ease-out, transform 150ms ease-out;
    }

    .fade-out {
      opacity: 0;
      transform: translateY(4px);
    }

    .fade-in {
      opacity: 1;
      transform: translateY(0);
    }
  `]
})
export class ImportDialogComponent {
  @Output() close = new EventEmitter<void>();

  activeTab = signal<ImportTab>('file');
  isTransitioning = signal(false);

  switchTab(tab: ImportTab): void {
    if (tab === this.activeTab()) return;
    
    // Trigger fade-out
    this.isTransitioning.set(true);
    
    // After fade-out, switch tab and fade-in
    setTimeout(() => {
      this.activeTab.set(tab);
      // Small delay before fade-in for smooth transition
      setTimeout(() => {
        this.isTransitioning.set(false);
      }, 30);
    }, 150);
  }
}
