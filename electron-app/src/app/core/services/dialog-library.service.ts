/**
 * Dialog Library Service
 *
 * Manages the lifecycle of user-imported dialog definitions.
 * Persists to localStorage, registers with the generic dialog registry,
 * and provides import/export operations.
 */

import { Injectable, signal, computed } from '@angular/core';
import type { PortableDialogSpec } from '../ai/generic-dialog/portable-dialog-spec';
import type { PortableSpecValidationResult } from '../ai/generic-dialog/portable-spec-validator';
import { parseAndValidatePortableSpec } from '../ai/generic-dialog/portable-spec-validator';
import { portableSpecToContract } from '../ai/generic-dialog/portable-to-contract';
import {
  registerDialogSpec,
  unregisterDialogSpec,
  getDialogSpec,
} from '../ai/generic-dialog/operation-spec.registry';

const STORAGE_KEY = 'r-instat-dialog-library';

@Injectable({ providedIn: 'root' })
export class DialogLibraryService {
  readonly importedSpecs = signal<PortableDialogSpec[]>([]);
  readonly importedCount = computed(() => this.importedSpecs().length);

  constructor() {
    this.loadFromStorage();
  }

  // ── Import ────────────────────────────────────────────────────────

  /** Import a dialog spec from a raw JSON string. */
  importFromJson(jsonString: string): PortableSpecValidationResult {
    const { spec, result } = parseAndValidatePortableSpec(jsonString);
    if (!spec) return result;

    // Check if already imported
    if (this.importedSpecs().some(s => s.dialogId === spec.dialogId)) {
      return {
        valid: false,
        errors: [`Dialog "${spec.dialogId}" is already imported`],
        warnings: [],
      };
    }

    this.registerOne(spec);
    this.importedSpecs.update(list => [...list, spec]);
    this.saveToStorage();

    return result;
  }

  /** Import from a file path via Electron IPC. */
  async importFromFile(filePath: string): Promise<PortableSpecValidationResult> {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.file?.readText) {
      return { valid: false, errors: ['File reading not available'], warnings: [] };
    }

    const { success, content, error } = await electronAPI.file.readText(filePath);
    if (!success || !content) {
      return { valid: false, errors: [error || 'Failed to read file'], warnings: [] };
    }

    return this.importFromJson(content);
  }

  // ── Export ────────────────────────────────────────────────────────

  /** Export an imported dialog spec as a JSON string. */
  exportToJson(dialogId: string): string | null {
    const spec = this.importedSpecs().find(s => s.dialogId === dialogId);
    if (!spec) return null;
    return JSON.stringify(spec, null, 2);
  }

  /** Export to file via Electron save dialog. */
  async exportToFile(dialogId: string): Promise<boolean> {
    const json = this.exportToJson(dialogId);
    if (!json) return false;

    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.dialog?.saveFile || !electronAPI?.file?.writeText) return false;

    const { canceled, filePath } = await electronAPI.dialog.saveFile({
      defaultPath: `${dialogId}.rinstat-dialog.json`,
      filters: [{ name: 'R-Instat Dialog', extensions: ['rinstat-dialog.json', 'json'] }],
    });

    if (canceled || !filePath) return false;

    const { success } = await electronAPI.file.writeText(filePath, json);
    return success;
  }

  // ── Remove ────────────────────────────────────────────────────────

  removeImported(dialogId: string): boolean {
    const idx = this.importedSpecs().findIndex(s => s.dialogId === dialogId);
    if (idx < 0) return false;

    unregisterDialogSpec(dialogId);
    this.importedSpecs.update(list => list.filter(s => s.dialogId !== dialogId));
    this.saveToStorage();
    return true;
  }

  // ── Query ─────────────────────────────────────────────────────────

  isImported(dialogId: string): boolean {
    return this.importedSpecs().some(s => s.dialogId === dialogId);
  }

  // ── Persistence ───────────────────────────────────────────────────

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as PortableDialogSpec[];
      if (!Array.isArray(parsed)) return;

      for (const spec of parsed) {
        this.registerOne(spec);
      }
      this.importedSpecs.set(parsed);
    } catch (e) {
      console.warn('[DialogLibrary] Failed to load from storage, clearing:', e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.importedSpecs()));
    } catch (e) {
      console.error('[DialogLibrary] Failed to save to storage:', e);
    }
  }

  private registerOne(spec: PortableDialogSpec): void {
    const contract = portableSpecToContract(spec);
    registerDialogSpec(contract);
  }
}
