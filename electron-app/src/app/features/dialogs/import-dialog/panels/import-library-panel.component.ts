import { Component, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RPackagesPanelComponent } from './r-packages-panel.component';
import { InstatCollectionPanelComponent } from './instat-collection-panel.component';

type LibraryOption = 'r-packages' | 'instat-collection';

@Component({
  selector: 'app-import-library-panel',
  standalone: true,
  imports: [CommonModule, RPackagesPanelComponent, InstatCollectionPanelComponent],
  template: `
    <div class="panel-content">
      <!-- Sub-option Toggle -->
      <div class="option-toggle">
        <div class="toggle-group">
          <button 
            class="toggle-btn"
            [class.active]="activeOption() === 'r-packages'"
            (click)="switchOption('r-packages')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="toggle-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span>R Packages</span>
          </button>
          <button 
            class="toggle-btn"
            [class.active]="activeOption() === 'instat-collection'"
            (click)="switchOption('instat-collection')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="toggle-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Instat Collection</span>
          </button>
        </div>
      </div>

      <!-- Panel Content with transition -->
      <div 
        class="sub-panel-wrapper"
        [class.fade-out]="isTransitioning()"
        [class.fade-in]="!isTransitioning()"
      >
        @switch (activeOption()) {
          @case ('r-packages') {
            <app-r-packages-panel (imported)="imported.emit()" />
          }
          @case ('instat-collection') {
            <app-instat-collection-panel (imported)="imported.emit()" />
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .panel-content {
      display: flex;
      flex-direction: column;
      min-height: 340px;
    }

    .option-toggle {
      margin-bottom: 1rem;
    }

    .toggle-group {
      display: flex;
      gap: 0.5rem;
      padding: 0.25rem;
      background: oklch(var(--b2) / 0.6);
      border-radius: 0.5rem;
    }

    .toggle-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      white-space: nowrap;
      border: none;
      border-radius: 0.375rem;
      background: transparent;
      color: oklch(var(--bc) / 0.7);
      cursor: pointer;
      transition: all 150ms ease-out;
    }

    .toggle-btn:hover:not(.active) {
      background: oklch(var(--bc) / 0.05);
      color: oklch(var(--bc));
    }

    .toggle-btn.active {
      background: oklch(var(--b1));
      color: oklch(var(--p));
      box-shadow: 0 1px 3px oklch(var(--bc) / 0.1);
    }

    .toggle-icon {
      width: 1rem;
      height: 1rem;
      flex-shrink: 0;
    }

    .sub-panel-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      transition: opacity 120ms ease-out, transform 120ms ease-out;
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
export class ImportLibraryPanelComponent {
  @Output() imported = new EventEmitter<void>();

  activeOption = signal<LibraryOption>('r-packages');
  isTransitioning = signal(false);

  switchOption(option: LibraryOption): void {
    if (option === this.activeOption()) return;
    
    this.isTransitioning.set(true);
    
    setTimeout(() => {
      this.activeOption.set(option);
      setTimeout(() => {
        this.isTransitioning.set(false);
      }, 20);
    }, 120);
  }
}
