/**
 * R Response Utilities
 * 
 * Composable utilities for handling R bridge responses.
 * These normalize R's JSON quirks (auto-unboxing, null handling, etc.)
 */

import { RResponse } from '../types';

/**
 * Normalize a value that should be an array
 * Handles R's auto-unboxing of single-element vectors
 * 
 * @param value - Value from R (could be string, array, null, undefined)
 * @returns Normalized string array
 */
export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === 'string' && value) {
    return [value];
  }
  return [];
}

/**
 * Normalize a numeric array from R
 * 
 * @param value - Value from R
 * @returns Normalized number array
 */
export function normalizeNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map(Number);
  }
  if (typeof value === 'number') {
    return [value];
  }
  return [];
}

/**
 * Extract array result from R response
 * 
 * @param response - R response object
 * @returns Array of strings if successful, empty array otherwise
 */
export function extractStringArray(response: RResponse): string[] {
  if (response.success) {
    return normalizeStringArray(response.result);
  }
  return [];
}

/**
 * Assert response success or throw
 * 
 * @param response - R response object
 * @param context - Context for error message
 * @throws Error if response is not successful
 */
export function assertSuccess(response: RResponse, context: string): void {
  if (!response.success) {
    throw new Error(`${context}: ${response.error || 'Unknown error'}`);
  }
}

/**
 * Check if a value is a non-empty string or array
 */
export function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'string') {
    return value.length > 0;
  }
  return value !== null && value !== undefined;
}
