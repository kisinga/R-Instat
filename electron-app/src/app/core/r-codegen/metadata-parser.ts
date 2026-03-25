/**
 * Metadata Parser Utility
 *
 * Utilities for parsing and manipulating dialog metadata in R code.
 * Supports two comment blocks:
 *   # R-Instat Dialog Metadata   — dialog state (dialogId + filled values)
 *   # R-Instat Dialog Definition — full portable spec (for self-contained sharing)
 */

import { DialogMetadata } from './dialog-metadata';
import type { PortableDialogSpec } from '../ai/generic-dialog/portable-dialog-spec';

/**
 * Extract metadata from R code
 * 
 * Parses the metadata comment block from R code and returns the parsed metadata.
 * Returns null if no metadata is found or if parsing fails.
 */
export function extractMetadata(code: string): DialogMetadata | null {
  const lines = code.split('\n');
  let inMetadataBlock = false;
  const metadataLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('# R-Instat Dialog Metadata')) {
      inMetadataBlock = true;
      continue;
    }
    
    if (inMetadataBlock) {
      // Skip the "DO NOT EDIT" line
      if (trimmed.includes('DO NOT EDIT')) {
        continue;
      }
      
      if (trimmed === '' || (!trimmed.startsWith('#') && trimmed !== '')) {
        // Empty line or non-comment line ends metadata block
        break;
      }
      
      // Remove comment prefix and collect
      const jsonLine = trimmed.replace(/^#\s*/, '');
      metadataLines.push(jsonLine);
    }
  }
  
  if (metadataLines.length === 0) {
    return null;
  }
  
  try {
    const jsonStr = metadataLines.join('\n');
    console.log('[MetadataParser] Extracted JSON string:', jsonStr);
    const parsed = JSON.parse(jsonStr) as DialogMetadata;
    console.log('[MetadataParser] Parsed metadata:', parsed);
    return parsed;
  } catch (error) {
    console.warn('[MetadataParser] Failed to parse metadata:', error, 'JSON string:', metadataLines.join('\n'));
    return null;
  }
}

/**
 * Strip metadata comment block from R code
 * 
 * Removes the metadata comment block for display purposes.
 * Returns the code unchanged if no metadata is found.
 */
export function stripMetadata(code: string): string {
  const lines = code.split('\n');
  const result: string[] = [];
  let inMetadataBlock = false;
  let foundMetadata = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('# R-Instat Dialog Metadata')) {
      inMetadataBlock = true;
      foundMetadata = true;
      continue;
    }
    
    if (inMetadataBlock) {
      if (trimmed === '' || (!trimmed.startsWith('#') && trimmed !== '')) {
        // Empty line or non-comment line ends metadata block
        inMetadataBlock = false;
        // Skip the empty line separator
        if (trimmed === '') {
          continue;
        }
      } else {
        // Still in metadata block, skip this line
        continue;
      }
    }
    
    result.push(line);
  }
  
  // Remove leading empty lines if metadata was found
  if (foundMetadata) {
    while (result.length > 0 && result[0].trim() === '') {
      result.shift();
    }
  }
  
  return result.join('\n');
}

/**
 * Check if R code contains metadata
 *
 * Quick check to determine if code has embedded metadata.
 */
export function hasMetadata(code: string): boolean {
  return code.includes('# R-Instat Dialog Metadata');
}

/**
 * Extract an embedded dialog definition from R code.
 *
 * Looks for:
 *   # R-Instat Dialog Definition
 *   # {"formatVersion":"1.0","dialogId":"my-test",...}
 *
 * Returns null if no definition block is found or parsing fails.
 */
export function extractDefinition(code: string): PortableDialogSpec | null {
  const lines = code.split('\n');
  let inBlock = false;
  const jsonLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('# R-Instat Dialog Definition')) {
      inBlock = true;
      continue;
    }

    if (inBlock) {
      if (trimmed === '' || (!trimmed.startsWith('#') && trimmed !== '')) {
        break;
      }
      jsonLines.push(trimmed.replace(/^#\s*/, ''));
    }
  }

  if (jsonLines.length === 0) return null;

  try {
    return JSON.parse(jsonLines.join('\n')) as PortableDialogSpec;
  } catch {
    return null;
  }
}

/**
 * Check if R code contains an embedded dialog definition.
 */
export function hasDefinition(code: string): boolean {
  return code.includes('# R-Instat Dialog Definition');
}
