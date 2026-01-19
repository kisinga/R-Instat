/**
 * Domain Expert Service
 * 
 * Central service for managing domain-specific workflows.
 * Domains are specialized analysis contexts (Climatic, Structured, Survey, etc.)
 * that provide curated tools for specific data types.
 */

import { Injectable, signal, computed } from '@angular/core';

/** Configuration for a domain-specific workflow */
export interface DomainConfig {
  id: string;
  labelKey: string;
  icon: string;
  descriptionKey: string;
  dialogs: DomainDialog[];
}

/** A dialog available within a domain */
export interface DomainDialog {
  labelKey: string;
  action: string;
  shortcut?: string;
}

@Injectable({ providedIn: 'root' })
export class DomainExpertService {
  /** Registry of available domains */
  readonly domains: DomainConfig[] = [
    {
      id: 'climatic',
      labelKey: 'DOMAIN.CLIMATIC',
      icon: '🌦️',
      descriptionKey: 'DOMAIN.CLIMATIC_DESC',
      dialogs: [
        { labelKey: 'CLIMATIC.SUMMARY', action: 'climatic-summary' },
        { labelKey: 'CLIMATIC.INVENTORY_PLOT', action: 'inventory-plot' },
      ]
    },
    // Future domains can be added here:
    // { id: 'structured', labelKey: 'DOMAIN.STRUCTURED', ... },
    // { id: 'survey', labelKey: 'DOMAIN.SURVEY', ... },
  ];

  /** Currently active domain (null if none selected) */
  private readonly _activeDomain = signal<DomainConfig | null>(null);
  readonly activeDomain = this._activeDomain.asReadonly();

  /** Whether a domain is currently active */
  readonly hasDomain = computed(() => this._activeDomain() !== null);

  /** Get the active domain's dialogs for menu rendering */
  readonly activeDialogs = computed(() => {
    const domain = this._activeDomain();
    return domain?.dialogs ?? [];
  });

  /**
   * Set the active domain
   * @param domainId - The domain ID to activate, or null to clear
   */
  setActiveDomain(domainId: string | null): void {
    if (domainId === null) {
      this._activeDomain.set(null);
      return;
    }

    const domain = this.domains.find(d => d.id === domainId);
    if (domain) {
      this._activeDomain.set(domain);
    }
  }

  /**
   * Clear the active domain
   */
  clearDomain(): void {
    this._activeDomain.set(null);
  }

  /**
   * Get a domain by ID
   */
  getDomain(id: string): DomainConfig | undefined {
    return this.domains.find(d => d.id === id);
  }
}
