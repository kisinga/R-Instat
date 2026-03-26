/**
 * Generic Dialog Specs Barrel
 *
 * Registers all generic dialog specs:
 * - Complex specs: TypeScript files in this directory (custom builders + validation)
 * - Simple specs: JSON files via builtin-json-specs.ts (builderId reference)
 */

// Complex specs — TypeScript (custom builder logic)
import './chi-square-test';
import './frequency-table';
import './row-summary';
import './convert-columns';
import './one-variable-summarise';

// Simple specs — JSON (builderId only)
import '../builtin-json-specs';
