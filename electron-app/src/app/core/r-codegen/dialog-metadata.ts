/**
 * Dialog Metadata Interface
 *
 * Metadata embedded in R code comments for dialog state restoration.
 * The dialogId is the sole identity — componentType is resolved from
 * the dialog identity registry at restore time.
 */

export interface DialogMetadata {
  dialogId: string;
  version: string;
  state: Record<string, any>;
  timestamp?: string;
}
