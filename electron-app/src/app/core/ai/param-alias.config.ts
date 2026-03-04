/**
 * Param alias config: map LLM-produced param names to schema param names per dialog.
 * Used by the intent resolver's single param-alias transform.
 */

export interface ParamAliasEntry {
  alias: string;
  schemaKey: string;
}

const T_TEST_ALIASES: ParamAliasEntry[] = [
  { alias: 'outcomeVariable', schemaKey: 'variable1' },
  { alias: 'responseVariable', schemaKey: 'variable1' },
  { alias: 'numericVariable', schemaKey: 'variable1' },
  { alias: 'groupVariable', schemaKey: 'groupVar' },
  { alias: 'groupingVariable', schemaKey: 'groupVar' },
  { alias: 'secondVariable', schemaKey: 'variable2' },
];

const CLIMATIC_ELEMENT_ALIASES: ParamAliasEntry[] = [
  { alias: 'measureColumn', schemaKey: 'elementColumn' },
  { alias: 'valueColumn', schemaKey: 'elementColumn' },
  { alias: 'timeColumn', schemaKey: 'dateColumn' },
  { alias: 'stationIdColumn', schemaKey: 'stationColumn' },
];

const ANNUAL_RAINFALL_ALIASES: ParamAliasEntry[] = [
  { alias: 'measureColumn', schemaKey: 'rainColumn' },
  { alias: 'elementColumn', schemaKey: 'rainColumn' },
  { alias: 'rainfallColumn', schemaKey: 'rainColumn' },
  { alias: 'precipitationColumn', schemaKey: 'rainColumn' },
];

export const PARAM_ALIAS_CONFIG = new Map<string, ParamAliasEntry[]>([
  ['t-test', T_TEST_ALIASES],
  ['climatic-summary', CLIMATIC_ELEMENT_ALIASES],
  ['seasonal-summary', CLIMATIC_ELEMENT_ALIASES],
  ['extremes', CLIMATIC_ELEMENT_ALIASES],
  ['day-count', CLIMATIC_ELEMENT_ALIASES],
  ['spell-lengths', CLIMATIC_ELEMENT_ALIASES],
  ['annual-rainfall', ANNUAL_RAINFALL_ALIASES],
]);
