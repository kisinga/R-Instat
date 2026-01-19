/**
 * R Backend Models
 * 
 * Type definitions for R communication
 */

/**
 * Result from R command execution
 */
export interface RResult {
  success: boolean;
  result?: {
    type: 'text' | 'dataframe' | 'plot' | 'error';
    value?: string | string[];
    data?: Record<string, unknown>[];
    path?: string;
    dataUrl?: string; // Base64 encoded image data URL for plots
    columns?: string[];
    totalRows?: number;
  };
  error?: string;
}

/**
 * Dataframe preview with column types and pagination
 */
export interface DataPreview {
  columns: string[];
  columnTypes: Record<string, string>;
  rows: Record<string, unknown>[];
  totalRows: number;
  offset: number;
  limit: number;
}

/**
 * Column information
 */
export interface ColumnInfo {
  name: string;
  type: string;
}

/**
 * Output history entry
 */
export interface OutputEntry {
  id: string;
  code: string;
  result: RResult;
  timestamp: Date;
  duration: number;
}

/**
 * R health status types
 */
export type RHealthStatusType = 'starting' | 'missing_packages' | 'installing' | 'ready' | 'error';

/**
 * R health status - tracks package availability and R process state
 */
export interface RHealthStatus {
  status: RHealthStatusType;
  missingPackages?: string[];
  installProgress?: {
    current: number;
    total: number;
    package: string;
  };
  error?: string;
}

/**
 * R column types mapped to display categories
 */
export type ColumnType = 'numeric' | 'character' | 'factor' | 'ordered_factor' | 'date' | 'logical' | 'unknown';

/**
 * Map R class to column type category
 */
export function mapRTypeToCategory(rType: string): ColumnType {
  const type = rType.toLowerCase();
  
  // Check ordered_factor first (more specific)
  if (type === 'ordered_factor' || type.includes('ordered')) {
    return 'ordered_factor';
  }
  if (type === 'factor' || type.includes('factor')) {
    return 'factor';
  }
  if (type.includes('numeric') || type.includes('integer') || type.includes('double')) {
    return 'numeric';
  }
  if (type.includes('character') || type.includes('string')) {
    return 'character';
  }
  if (type.includes('date') || type.includes('posix') || type.includes('time')) {
    return 'date';
  }
  if (type.includes('logical') || type.includes('bool')) {
    return 'logical';
  }
  
  return 'unknown';
}

/**
 * Get icon/label for column type (R-standard notation)
 * F = Factor, OF = Ordered Factor
 */
export function getColumnTypeIcon(type: ColumnType): string {
  switch (type) {
    case 'numeric': return '#';
    case 'character': return 'Aa';
    case 'factor': return 'F';
    case 'ordered_factor': return 'OF';
    case 'date': return 'D';
    case 'logical': return 'L';
    default: return '?';
  }
}
