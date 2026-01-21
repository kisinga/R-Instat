/**
 * Control Base - Abstract Base Class for R Code-Bound Controls
 *
 * Provides two-way binding between UI controls and R code structures.
 */

import { Signal, signal, computed, effect } from '@angular/core';
import { RCode, Parameter } from '../r-codegen/types';
import { RSyntax } from '../r-codegen/syntax';
import { Condition, evaluateConditions } from './conditions';
import { toScript } from '../r-codegen/core';

/**
 * Abstract base class for controls that bind to R code
 */
export abstract class ControlBase<T> {
  // Primary R code structure
  protected _rCode = signal<RCode | null>(null);

  // Primary parameter
  protected _parameter = signal<Parameter | null>(null);

  // Optional RSyntax for conditions
  protected _syntax = signal<RSyntax | null>(null);

  // R environment default
  protected _rDefault = signal<unknown>(null);

  // Control's object default
  protected _objectDefault = signal<unknown>(null);

  // Value to remove parameter when set
  protected _valueToRemove = signal<unknown>(null);

  // Conditions map: value -> conditions array
  protected _conditions = new Map<T, Condition[]>();

  // Behavior flags
  protected _canAddRemove = true;
  protected _canChangeValue = true;
  protected _allowNonConditionValues = true;
  protected _isActive = true;

  // Abstract: control's current value (must be implemented by subclass)
  abstract readonly value: Signal<T>;

  /**
   * Get primary R code
   */
  get rCode(): Signal<RCode | null> {
    return this._rCode.asReadonly();
  }

  /**
   * Get primary parameter
   */
  get parameter(): Signal<Parameter | null> {
    return this._parameter.asReadonly();
  }

  /**
   * Get RSyntax
   */
  get syntax(): Signal<RSyntax | null> {
    return this._syntax.asReadonly();
  }

  /**
   * Set primary R code and update control
   */
  setRCode(rCode: RCode | null, update: boolean = true): void {
    this._rCode.set(rCode);
    if (update) {
      this.updateFromRCode();
    }
  }

  /**
   * Set primary parameter
   */
  setParameter(parameter: Parameter | null): void {
    this._parameter.set(parameter);
  }

  /**
   * Set RSyntax
   */
  setSyntax(syntax: RSyntax | null): void {
    this._syntax.set(syntax);
    this.updateFromRCode();
  }

  /**
   * Set R default value
   */
  setRDefault(value: unknown): void {
    this._rDefault.set(value);
  }

  /**
   * Set object default value
   */
  setObjectDefault(value: unknown): void {
    this._objectDefault.set(value);
  }

  /**
   * Set value that should remove parameter
   */
  setValueToRemove(value: unknown): void {
    this._valueToRemove.set(value);
  }

  /**
   * Set conditions for value-to-conditions mapping
   */
  setConditions(conditions: Map<T, Condition[]>): void {
    this._conditions = conditions;
  }

  /**
   * Add condition for a value
   */
  addCondition(value: T, condition: Condition): void {
    if (!this._conditions.has(value)) {
      this._conditions.set(value, []);
    }
    this._conditions.get(value)!.push(condition);
  }

  /**
   * Check if parameter can be added (not at R default)
   */
  canAddParameter(): boolean {
    const param = this._parameter();
    const rDef = this._rDefault();
    const currentValue = this.value();

    if (!param) return false;

    // Check if current value equals remove value
    if (this._valueToRemove() !== null && currentValue === this._valueToRemove()) {
      return false;
    }

    // Check if current value equals R default
    if (rDef !== null && currentValue === rDef) {
      return false;
    }

    return true;
  }

  /**
   * Check if parameter value equals R default
   */
  isRDefault(): boolean {
    const param = this._parameter();
    const rDef = this._rDefault();
    
    if (!param || rDef === null) return false;
    
    if (typeof param.value === 'string') {
      return param.value === String(rDef);
    }
    
    return param.value === rDef;
  }

  /**
   * Add or remove parameter from R code
   */
  addOrRemoveParameter(add: boolean): void {
    if (!this._canAddRemove) return;

    const rCode = this._rCode();
    const param = this._parameter();

    if (!rCode || !param || typeof rCode === 'string') return;

    if (rCode.type === 'function') {
      if (add) {
        // Add parameter if not already present
        const existingIndex = rCode.params.findIndex((p) => p.name === param.name);
        if (existingIndex === -1) {
          rCode.params.push(param);
        } else {
          rCode.params[existingIndex] = param;
        }
      } else {
        // Remove parameter
        const index = rCode.params.findIndex((p) => p.name === param.name);
        if (index !== -1) {
          rCode.params.splice(index, 1);
        }
      }
    }
  }

  /**
   * Update control value from R code (R code → UI)
   * Uses conditions to determine correct value
   */
  updateFromRCode(): void {
    if (!this._isActive) return;

    const rCode = this._rCode();
    const param = this._parameter();
    const syntax = this._syntax();

    // Check conditions first
    let matched = false;
    for (const [value, conditions] of this._conditions.entries()) {
      if (evaluateConditions(conditions, rCode, param, syntax)) {
        this.setValue(value);
        matched = true;
        break;
      }
    }

    // If no condition matched and non-condition values allowed, set from parameter
    if (!matched && this._allowNonConditionValues) {
      const valueToSet = this.getValueToSet();
      if (valueToSet !== null && valueToSet !== undefined) {
        this.setValue(valueToSet as T);
      }
    }
  }

  /**
   * Update R code from control value (UI → R code)
   */
  updateToRCode(): void {
    if (!this._canChangeValue) return;

    const param = this._parameter();
    const currentValue = this.value();

    if (!param) return;

    // Update parameter value
    param.value = this.convertValueToRCodeValue(currentValue);

    // Add/remove parameter based on canAddParameter
    if (this._canAddRemove) {
      this.addOrRemoveParameter(this.canAddParameter());
    }
  }

  /**
   * Get value to set from parameter
   */
  protected getValueToSet(): unknown {
    const param = this._parameter();
    if (!param) return null;

    if (typeof param.value === 'string' || 
        typeof param.value === 'number' || 
        typeof param.value === 'boolean') {
      return param.value;
    }

    // For nested RCode, return the structure
    return param.value;
  }

  /**
   * Convert control value to RCodeValue
   */
  protected convertValueToRCodeValue(value: T): Parameter['value'] {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    
    // Assume it's already an RCode
    return value as unknown as RCode;
  }

  /**
   * Set control value (abstract, implemented by subclass)
   */
  protected abstract setValue(value: T): void;
}
