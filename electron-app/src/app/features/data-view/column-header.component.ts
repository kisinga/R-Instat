import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IHeaderParams, IHeaderComp } from 'ag-grid-community';

/**
 * Custom AG Grid header component
 * 
 * Displays column name followed by a styled type indicator badge.
 * Type indicators: # (numeric), Aa (character), F (factor), OF (ordered factor), etc.
 */
@Component({
  selector: 'app-column-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="column-header" [title]="tooltip">
      <span class="column-name">{{ columnName }}</span>
      <span class="type-badge" [class]="badgeClass">{{ typeIcon }}</span>
    </div>
  `,
  styles: [`
    .column-header {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      overflow: hidden;
    }
    
    .column-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .type-badge {
      font-size: 0.65rem;
      font-weight: 500;
      padding: 1px 4px;
      border-radius: 3px;
      flex-shrink: 0;
      opacity: 0.8;
    }
    
    /* Numeric types - blue tint */
    .type-badge.type-numeric {
      background-color: oklch(var(--in) / 0.2);
      color: oklch(var(--in));
    }
    
    /* Character/text types - green tint */
    .type-badge.type-character {
      background-color: oklch(var(--su) / 0.2);
      color: oklch(var(--su));
    }
    
    /* Factor types - purple tint */
    .type-badge.type-factor {
      background-color: oklch(var(--p) / 0.25);
      color: oklch(var(--p));
    }
    
    /* Ordered factor - purple with border */
    .type-badge.type-ordered_factor {
      background-color: oklch(var(--p) / 0.25);
      color: oklch(var(--p));
      border: 1px solid oklch(var(--p) / 0.5);
    }
    
    /* Date types - orange tint */
    .type-badge.type-date {
      background-color: oklch(var(--wa) / 0.2);
      color: oklch(var(--wa));
    }
    
    /* Logical types - neutral */
    .type-badge.type-logical {
      background-color: oklch(var(--bc) / 0.1);
      color: oklch(var(--bc) / 0.7);
    }
    
    /* Unknown types - muted */
    .type-badge.type-unknown {
      background-color: oklch(var(--bc) / 0.08);
      color: oklch(var(--bc) / 0.5);
    }
  `]
})
export class ColumnHeaderComponent implements IHeaderComp {
  columnName = '';
  typeIcon = '';
  tooltip = '';
  badgeClass = '';

  agInit(params: IHeaderParams & { typeIcon?: string; typeCategory?: string; tooltip?: string }): void {
    this.columnName = params.displayName || '';
    this.typeIcon = params.typeIcon || '?';
    this.tooltip = params.tooltip || this.columnName;
    this.badgeClass = `type-${params.typeCategory || 'unknown'}`;
  }

  refresh(params: IHeaderParams): boolean {
    return false;
  }

  getGui(): HTMLElement {
    // Not used in Angular component mode
    return document.createElement('div');
  }
}
