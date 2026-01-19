/**
 * R Bridge Types
 * 
 * Shared type definitions for R-Electron communication.
 */

/**
 * Command types supported by R bridge
 */
export type RCommandType = 
  | 'execute' 
  | 'get_dataframes' 
  | 'get_data_preview' 
  | 'get_columns' 
  | 'get_column_types' 
  | 'load_demo'
  | 'list_package_datasets'
  | 'load_package_dataset'
  | 'list_instat_collection'
  | 'load_instat_collection_dataset';

/**
 * Base command interface (without id, which is added by sendCommand)
 */
export interface RCommandBase {
  type: RCommandType;
  code?: string;
  name?: string;
  limit?: number;
  offset?: number;
  [key: string]: unknown;
}

/**
 * Full command sent to R process (with id)
 */
export interface RCommand extends RCommandBase {
  id: string;
}

/**
 * Response from R process
 */
export interface RResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Ready signal from R (special response on startup)
 */
export interface RReadySignal {
  ready: boolean;
}

/**
 * Structured result for execute commands
 */
export interface RExecuteResult {
  type: 'text' | 'dataframe' | 'plot' | 'error';
  value?: string | string[];
  data?: Record<string, unknown>[];
  path?: string;
  columns?: string[];
  totalRows?: number;
}

/**
 * Data preview response with pagination
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
 * Pending command tracker
 */
export interface PendingCommand {
  resolve: (value: RResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}
