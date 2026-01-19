/**
 * Domain Selector Component
 * 
 * Modal for selecting a domain-specific workflow.
 * Displays available domains as cards with icons and descriptions.
 */

import { Component, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DomainExpertService, DomainConfig } from '../../core/services/domain-expert.service';
import { RService } from '../../core/services/r.service';

@Component({
  selector: 'app-domain-selector',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="dialog-content domain-selector" (click)="$event.stopPropagation()">
      <!-- Header -->
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'DOMAIN.TITLE' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="close.emit()">✕</button>
      </div>

      <!-- Body -->
      <div class="dialog-body">
        <p class="text-sm text-base-content/70 mb-4">
          {{ 'DOMAIN.DESCRIPTION' | translate }}
        </p>

        <!-- Domain Cards Grid -->
        <div class="domain-grid">
          @for (domain of domainService.domains; track domain.id) {
            <button
              class="domain-card"
              [class.active]="domainService.activeDomain()?.id === domain.id"
              (click)="selectDomain(domain)"
            >
              <span class="domain-icon">{{ domain.icon }}</span>
              <div class="domain-info">
                <span class="domain-name">{{ domain.labelKey | translate }}</span>
                <span class="domain-desc">{{ domain.descriptionKey | translate }}</span>
              </div>
              @if (domainService.activeDomain()?.id === domain.id) {
                <span class="badge badge-primary badge-sm">{{ 'DOMAIN.ACTIVE' | translate }}</span>
              }
            </button>
          }
        </div>

        <!-- Active Domain Info -->
        @if (domainService.activeDomain(); as active) {
          <div class="active-domain-info mt-4 p-3 bg-base-200 rounded-lg">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-medium">{{ 'DOMAIN.CURRENT' | translate }}:</span>
                <span class="ml-2">{{ active.icon }} {{ active.labelKey | translate }}</span>
              </div>
              <button class="btn btn-ghost btn-xs" (click)="clearDomain()">
                {{ 'DOMAIN.CLEAR' | translate }}
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="close.emit()">{{ 'DIALOG.CLOSE' | translate }}</button>
      </div>
    </div>
  `,
  styles: [`
    .domain-selector {
      width: 500px;
      max-width: 90vw;
    }

    .domain-grid {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .domain-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border: 1px solid hsl(var(--b3));
      border-radius: 0.75rem;
      background: hsl(var(--b1));
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
    }

    .domain-card:hover {
      border-color: hsl(var(--p));
      background: hsl(var(--b2));
    }

    .domain-card.active {
      border-color: hsl(var(--p));
      background: hsl(var(--p) / 0.1);
    }

    .domain-icon {
      font-size: 2rem;
      line-height: 1;
    }

    .domain-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .domain-name {
      font-weight: 600;
      font-size: 0.95rem;
    }

    .domain-desc {
      font-size: 0.8rem;
      color: hsl(var(--bc) / 0.6);
    }
  `]
})
export class DomainSelectorComponent {
  @Output() close = new EventEmitter<void>();

  readonly domainService = inject(DomainExpertService);
  private readonly rService = inject(RService);

  selectDomain(domain: DomainConfig): void {
    this.domainService.setActiveDomain(domain.id);
    this.close.emit();
  }

  clearDomain(): void {
    this.domainService.clearDomain();
  }
}
