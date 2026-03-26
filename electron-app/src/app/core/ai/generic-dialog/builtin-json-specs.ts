/**
 * Built-in JSON Dialog Specs
 *
 * Self-registering module — importing this file registers all JSON-defined specs.
 * These are "simple" dialogs that reference a builderId (no custom TypeScript logic).
 * Complex dialogs stay as TypeScript files in specs/.
 */

import type { PortableDialogSpec } from './portable-dialog-spec';
import { portableSpecToContract } from './portable-to-contract';
import { registerDialogSpec } from './operation-spec.registry';

import duplicateColumns from '../../../../assets/dialogs/builtin/duplicate-columns.json';
import permuteColumn from '../../../../assets/dialogs/builtin/permute-column.json';
import deleteColumns from '../../../../assets/dialogs/builtin/delete-columns.json';
import insertColumn from '../../../../assets/dialogs/builtin/insert-column.json';
import correlationGeneric from '../../../../assets/dialogs/builtin/correlation-generic.json';
import regressionGeneric from '../../../../assets/dialogs/builtin/regression-generic.json';
import boxplotGeneric from '../../../../assets/dialogs/builtin/boxplot-generic.json';
import tTestGeneric from '../../../../assets/dialogs/builtin/t-test-generic.json';

const BUILTIN_JSON_SPECS = [
  duplicateColumns,
  permuteColumn,
  deleteColumns,
  insertColumn,
  correlationGeneric,
  regressionGeneric,
  boxplotGeneric,
  tTestGeneric,
] as PortableDialogSpec[];

// Self-register on import (same pattern as the TypeScript spec files)
for (const spec of BUILTIN_JSON_SPECS) {
  registerDialogSpec(portableSpecToContract(spec));
}
