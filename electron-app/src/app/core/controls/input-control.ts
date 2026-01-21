/**
 * Input Control - Simple text input bound to R code
 *
 * Example implementation of ControlBase for text input fields.
 */

import { Signal, signal, computed } from '@angular/core';
import { ControlBase } from './control-base';
import { Parameter } from '../r-codegen/types';

/**
 * Input control that binds a text input to an R parameter
 */
export class InputControl extends ControlBase<string> {
  private _value = signal<string>('');

  readonly value: Signal<string> = this._value.asReadonly();

  constructor() {
    super();
  }

  /**
   * Set the input value
   */
  protected setValue(value: string): void {
    this._value.set(value || '');
  }

  /**
   * Update value programmatically (for two-way binding)
   */
  setInputValue(value: string): void {
    this._value.set(value);
    this.updateToRCode();
  }

  /**
   * Get current input value
   */
  getInputValue(): string {
    return this._value();
  }

  /**
   * Override getValueToSet to handle string parameters
   */
  protected getValueToSet(): unknown {
    const param = this.parameter();
    if (!param) return '';

    if (typeof param.value === 'string') {
      return param.value;
    }

    // For non-string values, convert to string
    if (typeof param.value === 'number' || typeof param.value === 'boolean') {
      return String(param.value);
    }

    return '';
  }

  /**
   * Override convertValueToRCodeValue for string conversion
   */
  protected convertValueToRCodeValue(value: string): Parameter['value'] {
    if (value === '' || value === null || value === undefined) {
      return 'NULL';
    }
    return value;
  }
}
