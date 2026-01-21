/**
 * Climatic Role Mapper
 * 
 * Helper utility for mapping climatic roles to dialog field names.
 * Reduces boilerplate in climatic dialogs by providing a declarative mapping API.
 */

import { ClimaticRoles } from '../../../../core/services/climatic-data.service';

/**
 * Map climatic roles to dialog field names.
 * 
 * Supports both direct role mapping and function-based mapping for complex cases.
 * 
 * @param roles - Climatic roles from ClimaticDataService
 * @param fieldMappings - Object mapping field names to role keys or mapping functions
 * @returns Object with field names as keys and role values (or undefined)
 * 
 * @example
 * // Simple mapping
 * mapClimaticRolesToFields(roles, {
 *   dateColumn: 'date',
 *   stationColumn: 'station',
 * });
 * 
 * @example
 * // Function mapping for complex cases
 * mapClimaticRolesToFields(roles, {
 *   dateColumn: 'date',
 *   elementColumn: (r) => r.rain || r.element,
 *   stationColumn: 'station',
 * });
 */
export function mapClimaticRolesToFields(
  roles: ClimaticRoles,
  fieldMappings: Record<string, keyof ClimaticRoles | ((roles: ClimaticRoles) => string | undefined)>
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {};
  
  for (const [fieldName, mapping] of Object.entries(fieldMappings)) {
    if (typeof mapping === 'function') {
      result[fieldName] = mapping(roles);
    } else {
      result[fieldName] = roles[mapping];
    }
  }
  
  return result;
}
