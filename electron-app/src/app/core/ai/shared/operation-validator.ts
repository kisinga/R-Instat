/** True if operationId is a real registry id; false for null, undefined, empty, or placeholders like "N/A". */
export function isValidOperationId(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const s = String(value).trim().toLowerCase();
  return s !== '' && !['n/a', 'none', 'null'].includes(s);
}
