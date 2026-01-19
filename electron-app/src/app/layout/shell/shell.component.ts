import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToolbarComponent } from '../toolbar/toolbar.component';
import { StatusbarComponent } from '../statusbar/statusbar.component';
import { DataViewComponent } from '../../features/data-view/data-view.component';
import { OutputPanelComponent } from '../../features/output/output-panel.component';
import { WelcomeComponent } from '../../features/welcome/welcome.component';
import { DialogHostComponent } from '../../features/dialogs/dialog-host.component';
import { RService } from '../../core/services/r.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    ToolbarComponent,
    StatusbarComponent,
    DataViewComponent,
    OutputPanelComponent,
    WelcomeComponent,
    DialogHostComponent,
  ],
  template: `
    <div class="app-layout">
      <!-- Toolbar -->
      <app-toolbar />

      <!-- Main Content Area -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Left Panel: Welcome or Data View -->
        <div 
          class="flex flex-col transition-all duration-200"
          [style.width.%]="showWelcome() ? 100 : leftPanelWidth()"
          style="height: 100%; overflow: hidden;"
        >
          @if (showWelcome()) {
            <app-welcome 
              style="height: 100%;"
              (loadDemo)="onLoadDemo()" 
            />
          } @else {
            <app-data-view style="height: 100%;" />
          }
        </div>

        <!-- Resizer (hidden when welcome is shown) -->
        @if (!showWelcome()) {
          <div 
            class="w-1 bg-base-300 hover:bg-primary/50 cursor-col-resize flex-shrink-0 transition-colors"
            (mousedown)="startResize($event)"
          ></div>
        }

        <!-- Output Panel (always rendered, hidden when welcome is shown) -->
        <div 
          class="flex flex-col transition-all duration-200"
          [style.width.%]="showWelcome() ? 0 : (100 - leftPanelWidth())"
          [class.hidden]="showWelcome()"
          style="height: 100%; overflow: hidden;"
        >
          <app-output-panel style="height: 100%;" />
        </div>
      </div>

      <!-- Statusbar -->
      <app-statusbar />

      <!-- Dialog Host (renders active dialogs) -->
      <app-dialog-host />
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
    }
  `]
})
export class ShellComponent implements OnInit, OnDestroy {
  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);
  private subscription?: Subscription;

  showWelcome = signal(true);
  leftPanelWidth = signal(60); // 60% for data view
  
  private isResizing = false;

  ngOnInit(): void {
    // Subscribe to dataframe changes - hide welcome when data is loaded
    this.subscription = this.rService.onDataRefresh$.subscribe(() => {
      const dfs = this.rService.dataframes();
      if (dfs.length > 0) {
        this.showWelcome.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async onLoadDemo(): Promise<void> {
    try {
      const result = await this.rService.loadDemoData();
      if (result.success) {
        const dataframes = this.rService.dataframes();
        this.toastService.success(
          `Loaded ${dataframes.length} dataset${dataframes.length > 1 ? 's' : ''}: ${dataframes.join(', ')}`
        );
      } else {
        this.toastService.error(result.error || 'Failed to load demo data');
      }
    } catch (error) {
      this.toastService.error(error instanceof Error ? error.message : 'Failed to load demo data');
    }
  }

  startResize(event: MouseEvent): void {
    event.preventDefault();
    this.isResizing = true;

    const startX = event.clientX;
    const startWidth = this.leftPanelWidth();
    const container = (event.target as HTMLElement).parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth;

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isResizing) return;
      
      const delta = e.clientX - startX;
      const deltaPercent = (delta / containerWidth) * 100;
      const newWidth = Math.min(80, Math.max(20, startWidth + deltaPercent));
      this.leftPanelWidth.set(newWidth);
    };

    const onMouseUp = () => {
      this.isResizing = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}
