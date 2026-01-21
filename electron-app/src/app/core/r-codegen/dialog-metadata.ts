/**
 * Dialog Metadata Interface
 * 
 * Metadata embedded in R code comments for dialog state restoration.
 */

export interface DialogMetadata {
  dialogId: string;
  componentType: string;
  version: string;
  state: Record<string, any>;
  timestamp?: string;
}
