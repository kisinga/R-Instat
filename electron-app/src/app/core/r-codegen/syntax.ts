/**
 * RSyntax - Composable R Code Container
 *
 * Container for before/base/after code with assignment support.
 * This is the only class in the codegen layer, needed for immutable API.
 */

import { RCode, Assignment, Parameter } from './types';
import { toScript } from './core';
import { generateAssignment } from './assignment';

/**
 * RSyntax - Container for composable R code
 *
 * Supports:
 * - Before code (setup)
 * - Base code (main command)
 * - After code (cleanup)
 * - Assignment (for base code)
 */
export class RSyntax {
  base?: RCode;
  before: Array<{ code: RCode; position: number }> = [];
  after: Array<{ code: RCode; position: number }> = [];
  assignment?: Assignment;

  constructor(base?: RCode, assignment?: Assignment) {
    this.base = base;
    this.assignment = assignment;
  }

  /**
   * Add code to run before the base code
   */
  addBefore(code: RCode, position: number = -1): RSyntax {
    const newSyntax = this.clone();
    newSyntax.before.push({ code, position });
    return newSyntax;
  }

  /**
   * Add code to run after the base code
   */
  addAfter(code: RCode, position: number = -1): RSyntax {
    const newSyntax = this.clone();
    newSyntax.after.push({ code, position });
    return newSyntax;
  }

  /**
   * Set the base (main) code
   */
  setBase(code: RCode): RSyntax {
    const newSyntax = this.clone();
    newSyntax.base = code;
    return newSyntax;
  }

  /**
   * Set the assignment for the base code
   */
  setAssignment(assignment: Assignment): RSyntax {
    const newSyntax = this.clone();
    newSyntax.assignment = assignment;
    return newSyntax;
  }

  /**
   * Sort code list by position (-1 goes to end)
   */
  private sortByPosition(
    items: Array<{ code: RCode; position: number }>
  ): RCode[] {
    return [...items]
      .sort((a, b) => {
        const posA = a.position === undefined ? -1 : a.position;
        const posB = b.position === undefined ? -1 : b.position;
        if (posA === -1 && posB !== -1) return 1;
        if (posB === -1 && posA !== -1) return -1;
        if (posA === -1 && posB === -1) return 0;
        return posA - posB;
      })
      .map((item) => item.code);
  }

  /**
   * Generate the complete R script
   */
  toScript(): string {
    const lines: string[] = [];
    let script = '';

    // Before code
    const sortedBefore = this.sortByPosition(this.before);
    for (const code of sortedBefore) {
      const codeStr = toScript(code, script);
      if (codeStr) {
        lines.push(codeStr);
        script += codeStr + '\n';
      }
    }

    // Base code (with optional assignment)
    if (this.base) {
      let baseStr = toScript(this.base, script);
      
      if (this.assignment) {
        // Generate assignment (modifies script for multi-line assignments)
        baseStr = generateAssignment(baseStr, this.assignment, script);
      }
      
      if (baseStr) {
        lines.push(baseStr);
        script += baseStr + '\n';
      }
    }

    // After code
    const sortedAfter = this.sortByPosition(this.after);
    for (const code of sortedAfter) {
      const codeStr = toScript(code, script);
      if (codeStr) {
        lines.push(codeStr);
        script += codeStr + '\n';
      }
    }

    return lines.join('\n');
  }

  /**
   * Recursively collect all RCode structures that need assignment
   */
  getAllAssignments(): RCode[] {
    const codes: RCode[] = [];

    // Before code
    for (const item of this.before) {
      codes.push(item.code);
      // Recursively collect from nested structures
      if (typeof item.code !== 'string' && item.code.type === 'function') {
        for (const param of item.code.params) {
          if (typeof param.value !== 'string' && 
              typeof param.value !== 'number' && 
              typeof param.value !== 'boolean') {
            codes.push(param.value);
          }
        }
      }
    }

    // Base code
    if (this.base) {
      codes.push(this.base);
      if (typeof this.base !== 'string' && this.base.type === 'function') {
        for (const param of this.base.params) {
          if (typeof param.value !== 'string' && 
              typeof param.value !== 'number' && 
              typeof param.value !== 'boolean') {
            codes.push(param.value);
          }
        }
      }
    }

    // After code
    for (const item of this.after) {
      codes.push(item.code);
      if (typeof item.code !== 'string' && item.code.type === 'function') {
        for (const param of item.code.params) {
          if (typeof param.value !== 'string' && 
              typeof param.value !== 'number' && 
              typeof param.value !== 'boolean') {
            codes.push(param.value);
          }
        }
      }
    }

    return codes;
  }

  /**
   * Clone this RSyntax instance
   */
  private clone(): RSyntax {
    const newSyntax = new RSyntax(this.base, this.assignment);
    newSyntax.before = [...this.before];
    newSyntax.after = [...this.after];
    return newSyntax;
  }
}
