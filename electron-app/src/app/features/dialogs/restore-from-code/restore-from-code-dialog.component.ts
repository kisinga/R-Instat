/**
 * Restore From Code Dialog Component
 * 
 * Dialog for pasting R code and restoring the dialog state that generated it.
 */

import { Component, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { extractMetadata, stripMetadata, hasMetadata } from '../../../core/r-codegen/metadata-parser';
import { DialogMetadata } from '../../../core/r-codegen/dialog-metadata';
import { isKnownDialogId } from '../../../core/ai/dialog-identity.registry';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';

@Component({
  selector: 'app-restore-from-code-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, CodePreviewComponent],
  template: `
    <div class="dialog-content restore-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">Restore From Code</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
      </div>

      <div class="dialog-body">
        <div class="form-group">
          <label class="form-label">Paste R Code</label>
          <textarea 
            class="textarea textarea-bordered w-full font-mono text-sm"
            rows="10"
            [ngModel]="codeInput()"
            (ngModelChange)="codeInput.set($event)"
            placeholder="# Paste R code here..."
          ></textarea>
        </div>

        <!-- Validation Messages -->
        @if (codeInput()) {
          <div class="mt-2">
            @if (metadata()) {
              <div class="alert alert-success alert-sm">
                <span>Metadata detected: {{ getDialogName(metadata()!) }}</span>
              </div>
            } @else if (hasMetadata(codeInput())) {
              <div class="alert alert-warning alert-sm">
                <span>Invalid metadata format</span>
              </div>
            } @else {
              <div class="alert alert-error alert-sm">
                <span>No metadata found in code</span>
              </div>
            }
          </div>
          @if (syntaxError()) {
            <div class="mt-1">
              <div class="alert alert-error alert-sm">
                <span>Syntax error: {{ syntaxError() }}</span>
              </div>
            </div>
          }
        }

        <!-- Code Preview -->
        @if (codeInput() && metadata()) {
          <div class="mt-4">
            <app-code-preview [code]="codeInput()" [collapsible]="true" />
          </div>
        }
      </div>

      <div class="dialog-footer">
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="cancel()">Cancel</button>
        <button 
          class="btn btn-primary" 
          (click)="restoreDialog()"
          [disabled]="!canRestore()"
        >
          Restore Dialog
        </button>
      </div>
    </div>
  `,
  styles: [`
    .restore-dialog {
      width: 700px;
      max-width: 90vw;
    }
  `]
})
export class RestoreFromCodeDialogComponent extends DialogBase {
  static { AIDialogClassRegistry.register(RestoreFromCodeDialogComponent); }
  static readonly dialogId = 'restore-from-code';

  codeInput = signal('');
  syntaxError = signal<string | null>(null);

  private validateEffect = effect(() => {
    const code = this.codeInput();
    if (!code) {
      this.syntaxError.set(null);
      return;
    }
    const stripped = stripMetadata(code);
    if (!stripped.trim()) {
      this.syntaxError.set(null);
      return;
    }
    this.rService.validate(stripped).then(result => {
      this.syntaxError.set(result.success ? null : (result.error ?? 'Invalid syntax'));
    }).catch(() => {
      this.syntaxError.set(null); // Can't validate (R not ready) - don't block
    });
  });

  metadata = computed(() => {
    const code = this.codeInput();
    if (!code) return null;
    return extractMetadata(code);
  });

  canRestore = computed(() => {
    if (this.syntaxError()) return false;
    const meta = this.metadata();
    if (!meta) return false;
    return isKnownDialogId(meta.dialogId);
  });

  hasMetadata(code: string): boolean {
    return hasMetadata(code);
  }

  getDialogName(metadata: DialogMetadata): string {
    return metadata.dialogId
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async restoreDialog(): Promise<void> {
    const metadata = this.metadata();
    if (!metadata) {
      this.toastService.error('No metadata found in code');
      return;
    }

    const dialogId = metadata.dialogId;
    if (!isKnownDialogId(dialogId)) {
      this.toastService.error(`Unknown dialog: ${dialogId}`);
      return;
    }

    // Check if dataframe exists (if specified in state)
    if (metadata.state['dataframe']) {
      const dataframes = this.dataframes();
      if (!dataframes.includes(metadata.state['dataframe'] as string)) {
        this.toastService.warning(`Dataframe "${metadata.state['dataframe']}" not found. Dialog will open but state may not restore correctly.`);
      }
    }

    // Set restore data first
    this.dialogRestoreService.setRestoreData(metadata);
    console.log('[RestoreDialog] Set restore data, opening dialog:', dialogId);
    
    // Close this dialog through the RService to ensure proper cleanup
    this.rService.closeDialog('restore-from-code');
    
    // Use setTimeout to ensure close is processed before opening new dialog
    // The dialog host needs to clear the current dialog before opening a new one
    setTimeout(() => {
      console.log('[RestoreDialog] Opening target dialog:', dialogId);
      this.rService.openDialog(dialogId);
      this.toastService.success(`Opening ${this.getDialogName(metadata)} dialog...`);
    }, 100);
  }

  override isValid(): boolean {
    return this.canRestore();
  }
}
