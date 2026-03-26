/**
 * Portable-to-Contract Adapter
 *
 * Converts a PortableDialogSpec (JSON) into a DialogContract.
 * R code generation info (builderId, rGen, rCode) is stored on the contract
 * and resolved by compileStep() at call time — not here.
 */

import type { DialogContract } from '../dialog-catalog';
import type { PortableDialogSpec } from './portable-dialog-spec';
import { runValidationRules } from './declarative-validator';

export function portableSpecToContract(spec: PortableDialogSpec): DialogContract {
  return {
    dialogId: spec.dialogId,
    componentType: 'GenericDialogComponent',
    builderId: spec.builderId,
    rGen: spec.rGen,
    rCode: spec.rCode,
    title: spec.title,
    family: spec.family,
    description: spec.description,
    operations: spec.operations,
    params: spec.params,
    retrievalHints: spec.retrievalHints,
    validate: spec.validations?.length
      ? (state) => runValidationRules(spec.validations!, state)
      : undefined,
  };
}
