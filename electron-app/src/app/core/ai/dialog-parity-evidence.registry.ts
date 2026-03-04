export interface DialogParityEvidenceEntry {
  dialogId: string;
  status: 'complete' | 'partial';
  artifactPath: string;
}

/**
 * Release gate source-of-truth for parity evidence on migrated dialogs.
 * This is intentionally explicit to make review/approval visible in PRs.
 */
export const DIALOG_PARITY_EVIDENCE: DialogParityEvidenceEntry[] = [
  {
    dialogId: 'bar-chart',
    status: 'complete',
    artifactPath: 'src/app/core/ai/bar-chart-parity-contract.md',
  },
  {
    dialogId: 'histogram',
    status: 'complete',
    artifactPath: 'src/app/core/ai/dialog-parity-wave-plan.md',
  },
];
