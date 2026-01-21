/**
 * Dialog Builder Types
 *
 * Type definitions for dialog R code builders.
 */

import { RSyntax } from '../../r-codegen/syntax';

/**
 * Builder function that generates RSyntax from current dialog state.
 *
 * Builders are pure functions that capture dialog state via closure.
 * They are called lazily when DialogRCodeManager.rebuild() is invoked.
 *
 * @example
 * ```typescript
 * const builder: DialogBuilder = () =>
 *   buildBarChart({
 *     dataframe: this.selectedDataframe(),
 *     xVariable: this.xVariable(),
 *   });
 * ```
 */
export type DialogBuilder = () => RSyntax;
