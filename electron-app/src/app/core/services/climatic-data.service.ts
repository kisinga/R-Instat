/**
 * Climatic Data Service
 * 
 * Manages column role assignments for climatic data analysis.
 * Stores which columns represent date, station, elements, etc.
 * Provides auto-detection heuristics and persistence per dataframe.
 */

import { Injectable, signal, computed } from '@angular/core';

/** Semantic roles for climatic data columns */
export type ClimaticColumnRole = 
  | 'date'      // Date column (will be converted if needed)
  | 'station'   // Station/location identifier
  | 'year'      // Year component
  | 'month'     // Month component  
  | 'doy'       // Day of year
  | 'rain'      // Rainfall/precipitation
  | 'tmax'      // Maximum temperature
  | 'tmin'      // Minimum temperature
  | 'element';  // Generic element (for single-element analysis)

/** Column role assignment for a dataframe */
export interface ClimaticRoles {
  date?: string;
  station?: string;
  year?: string;
  month?: string;
  doy?: string;
  rain?: string;
  tmax?: string;
  tmin?: string;
  element?: string;
}

/** Full configuration for a climatic dataframe */
export interface ClimaticDataConfig {
  dataframe: string;
  roles: ClimaticRoles;
  dateConverted: boolean;
}

/** Heuristics for auto-detecting column roles by name */
const ROLE_PATTERNS: Record<ClimaticColumnRole, RegExp[]> = {
  date: [/^date$/i, /^dat$/i, /^fecha$/i],
  station: [/^station$/i, /^stn$/i, /^site$/i, /^location$/i, /^estacion$/i],
  year: [/^year$/i, /^yr$/i, /^ano$/i],
  month: [/^month$/i, /^mon$/i, /^mes$/i],
  doy: [/^doy$/i, /^day_of_year$/i, /^jday$/i, /^julian$/i],
  rain: [/^rain$/i, /^rainfall$/i, /^precip$/i, /^precipitation$/i, /^prcp$/i, /^lluvia$/i],
  tmax: [/^tmax$/i, /^temp_max$/i, /^max_temp$/i, /^maximum$/i],
  tmin: [/^tmin$/i, /^temp_min$/i, /^min_temp$/i, /^minimum$/i],
  element: [/^element$/i, /^value$/i, /^obs$/i],
};

@Injectable({ providedIn: 'root' })
export class ClimaticDataService {
  /** Storage of configurations per dataframe */
  private readonly _configs = signal<Map<string, ClimaticDataConfig>>(new Map());

  /** Get all configured dataframes */
  readonly configuredDataframes = computed(() => {
    return Array.from(this._configs().keys());
  });

  /**
   * Get configuration for a dataframe
   */
  getConfig(dataframe: string): ClimaticDataConfig | undefined {
    return this._configs().get(dataframe);
  }

  /**
   * Check if a dataframe has climatic configuration
   */
  isConfigured(dataframe: string): boolean {
    const config = this._configs().get(dataframe);
    return !!(config && Object.keys(config.roles).length > 0);
  }

  /**
   * Get column by role for a dataframe
   */
  getColumnByRole(dataframe: string, role: ClimaticColumnRole): string | undefined {
    const config = this._configs().get(dataframe);
    return config?.roles[role];
  }

  /**
   * Get all roles for a dataframe
   */
  getRoles(dataframe: string): ClimaticRoles {
    return this._configs().get(dataframe)?.roles ?? {};
  }

  /**
   * Set a column role for a dataframe
   */
  setColumnRole(dataframe: string, column: string, role: ClimaticColumnRole): void {
    const configs = new Map(this._configs());
    const existing = configs.get(dataframe) ?? {
      dataframe,
      roles: {},
      dateConverted: false,
    };

    existing.roles[role] = column;
    configs.set(dataframe, existing);
    this._configs.set(configs);
  }

  /**
   * Set multiple roles at once
   */
  setRoles(dataframe: string, roles: ClimaticRoles): void {
    const configs = new Map(this._configs());
    const existing = configs.get(dataframe);
    
    configs.set(dataframe, {
      dataframe,
      roles: { ...existing?.roles, ...roles },
      dateConverted: existing?.dateConverted ?? false,
    });
    this._configs.set(configs);
  }

  /**
   * Mark date column as converted
   */
  markDateConverted(dataframe: string): void {
    const configs = new Map(this._configs());
    const existing = configs.get(dataframe);
    if (existing) {
      existing.dateConverted = true;
      configs.set(dataframe, existing);
      this._configs.set(configs);
    }
  }

  /**
   * Check if date column has been converted
   */
  isDateConverted(dataframe: string): boolean {
    return this._configs().get(dataframe)?.dateConverted ?? false;
  }

  /**
   * Clear configuration for a dataframe
   */
  clearConfig(dataframe: string): void {
    const configs = new Map(this._configs());
    configs.delete(dataframe);
    this._configs.set(configs);
  }

  /**
   * Auto-detect column roles based on column names
   * Returns suggested roles (does not auto-apply them)
   */
  autoDetectRoles(columns: string[]): ClimaticRoles {
    const detected: ClimaticRoles = {};

    for (const column of columns) {
      for (const [role, patterns] of Object.entries(ROLE_PATTERNS)) {
        if (patterns.some(p => p.test(column))) {
          // Only set if not already detected (first match wins)
          if (!detected[role as ClimaticColumnRole]) {
            detected[role as ClimaticColumnRole] = column;
          }
          break;
        }
      }
    }

    return detected;
  }

  /**
   * Auto-detect and apply roles for a dataframe
   */
  autoDetectAndApply(dataframe: string, columns: string[]): ClimaticRoles {
    const detected = this.autoDetectRoles(columns);
    if (Object.keys(detected).length > 0) {
      this.setRoles(dataframe, detected);
    }
    return detected;
  }
}
