/**
 * Portable-to-Contract Adapter
 *
 * Converts a PortableDialogSpec (JSON-serializable) into a live DialogContract
 * that can be registered with registerDialogSpec().
 */

import type { DialogContract } from '../dialog-catalog';
import type { PortableDialogSpec } from './portable-dialog-spec';
import { interpolateRCode } from './r-code-interpolator';
import { runValidationRules } from './declarative-validator';

export function portableSpecToContract(spec: PortableDialogSpec): DialogContract {
  return {
    dialogId: spec.dialogId,
    componentType: 'GenericDialogComponent',
    title: spec.title,
    family: spec.family,
    description: spec.description,
    operations: spec.operations,
    params: spec.params,
    retrievalHints: spec.retrievalHints,
    validate: spec.validations?.length
      ? (state) => runValidationRules(spec.validations!, state)
      : undefined,
    build: (state) => interpolateRCode(spec.rCode, state, spec.params),
  };
}
