export type MappedColumnType = 'numeric' | 'factor' | 'date' | 'any';

export function mapColumnType(rawType: string): MappedColumnType {
  const t = rawType.toLowerCase();
  if (['numeric', 'integer', 'double'].some((x) => t.includes(x))) return 'numeric';
  if (['factor', 'character'].some((x) => t.includes(x))) return 'factor';
  if (['date', 'posix'].some((x) => t.includes(x))) return 'date';
  return 'any';
}
