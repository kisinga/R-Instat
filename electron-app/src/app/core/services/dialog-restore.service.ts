/**
 * Dialog Restore Service
 * 
 * Manages restoration state for dialogs opened from R code metadata.
 */

import { Injectable, signal } from '@angular/core';
import { DialogMetadata } from '../r-codegen/dialog-metadata';

@Injectable({ providedIn: 'root' })
export class DialogRestoreService {
  private restoreData = signal<DialogMetadata | null>(null);
  
  /**
   * Set restoration data before opening a dialog
   */
  setRestoreData(metadata: DialogMetadata): void {
    this.restoreData.set(metadata);
  }
  
  /**
   * Get restoration data (checked by dialogs in ngOnInit)
   */
  getRestoreData(): DialogMetadata | null {
    return this.restoreData();
  }
  
  /**
   * Clear restoration data after successful restoration
   */
  clearRestoreData(): void {
    this.restoreData.set(null);
  }
}
