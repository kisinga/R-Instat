/**
 * Step Executor Service.
 *
 * Executes resolved plan steps (dialog opening or code execution).
 * Extracted from ai-assist-dialog.component.ts for reuse by the chat tab.
 */

import { Injectable, inject } from '@angular/core';
import { RService } from './r.service';
import { DialogRestoreService } from './dialog-restore.service';
import { AppStateService } from './app-state.service';
import { ChatStoreService } from './chat-store.service';
import { ToastService } from './toast.service';
import type { ResolvedPlanStep } from './intent-resolver.service';

@Injectable({ providedIn: 'root' })
export class StepExecutorService {
  private readonly rService = inject(RService);
  private readonly dialogRestore = inject(DialogRestoreService);
  private readonly appState = inject(AppStateService);
  private readonly chatStore = inject(ChatStoreService);
  private readonly toastService = inject(ToastService);

  async executeDialogStep(step: ResolvedPlanStep): Promise<void> {
    if (!step.metadata) return;

    this.dialogRestore.setRestoreData({
      dialogId: step.metadata.dialogId,
      version: '1.0',
      state: step.metadata.state,
      timestamp: new Date().toISOString(),
    });

    this.appState.openDialog(step.metadata.dialogId);
    this.toastService.success(`Opening ${step.metadata.dialogId}...`);
  }

  async executeCodeStep(step: ResolvedPlanStep): Promise<void> {
    if (!step.code) return;

    const result = await this.rService.execute(step.code.script);

    // Dual visibility: Output tab gets it via RService.output$,
    // and chat gets an inline code-result message.
    this.chatStore.appendCodeResultMessage(
      step.code.script,
      result.success ? undefined : (result.error ?? 'Unknown error'),
      result.success
    );

    if (result.success) {
      this.toastService.success('Code step executed successfully.');
    } else {
      this.toastService.error(result.error ?? 'Code step failed.');
    }
  }
}
