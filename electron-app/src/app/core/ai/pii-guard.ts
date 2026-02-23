import type { DataContext, AIPlan } from '../services/ai-client.service';

export interface AliasMaps {
  readonly dataframeToAlias: Readonly<Record<string, string>>;
  readonly aliasToDataframe: Readonly<Record<string, string>>;
  readonly columnToAliasByDataframe: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly aliasToColumn: Readonly<Record<string, string>>;
}

export interface AliasResult {
  readonly context: DataContext;
  readonly maps: AliasMaps;
}

export interface PrivacyReport {
  readonly redactedPatterns: string[];
  readonly aliasedDataframes: number;
  readonly aliasedColumns: number;
}

export function redactUserInput(input: string): { value: string; patterns: string[] } {
  let value = input;
  const patterns = new Set<string>();

  const replacers: Array<{ name: string; regex: RegExp; replacement: string }> = [
    { name: 'email', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[REDACTED_EMAIL]' },
    { name: 'phone', regex: /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)\d{3,4}[-.\s]?\d{3,4}\b/g, replacement: '[REDACTED_PHONE]' },
    { name: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },
    { name: 'credit_card', regex: /\b(?:\d[ -]*?){13,19}\b/g, replacement: '[REDACTED_CARD]' },
    { name: 'ipv4', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: '[REDACTED_IP]' },
  ];

  for (const replacer of replacers) {
    if (replacer.regex.test(value)) {
      patterns.add(replacer.name);
      value = value.replace(replacer.regex, replacer.replacement);
    }
  }

  return { value, patterns: Array.from(patterns) };
}

export function aliasDataContext(context: DataContext): AliasResult {
  const dataframeToAlias: Record<string, string> = {};
  const aliasToDataframe: Record<string, string> = {};
  const columnToAliasByDataframe: Record<string, Record<string, string>> = {};
  const aliasToColumn: Record<string, string> = {};

  const dataframes = context.dataframes.map((df, index) => {
    const alias = `df_${index + 1}`;
    dataframeToAlias[df] = alias;
    aliasToDataframe[alias] = df;
    return alias;
  });

  const columnsByDataframe: Record<string, Array<{ name: string; type: string }>> = {};
  for (const [dfName, columns] of Object.entries(context.columnsByDataframe)) {
    const dfAlias = dataframeToAlias[dfName];
    if (!dfAlias) continue;

    columnToAliasByDataframe[dfName] = {};
    columnsByDataframe[dfAlias] = columns.map((col, index) => {
      const alias = `${dfAlias}_col_${index + 1}`;
      columnToAliasByDataframe[dfName][col.name] = alias;
      aliasToColumn[alias] = col.name;
      return { name: alias, type: col.type };
    });
  }

  const activeDataframe = context.activeDataframe ? (dataframeToAlias[context.activeDataframe] ?? null) : null;

  return {
    context: {
      dataframes,
      activeDataframe,
      columnsByDataframe,
    },
    maps: {
      dataframeToAlias,
      aliasToDataframe,
      columnToAliasByDataframe,
      aliasToColumn,
    },
  };
}

export function applyAliasesToInput(input: string, maps: AliasMaps): string {
  let aliased = input;
  const replacements = Object.entries({
    ...maps.dataframeToAlias,
    ...Object.values(maps.columnToAliasByDataframe).reduce<Record<string, string>>((acc, value) => ({ ...acc, ...value }), {}),
  }).sort((a, b) => b[0].length - a[0].length);

  for (const [original, alias] of replacements) {
    const rx = new RegExp(`\\b${escapeRegExp(original)}\\b`, 'g');
    aliased = aliased.replace(rx, alias);
  }
  return aliased;
}

export function deAliasPlan(plan: AIPlan, maps: AliasMaps): AIPlan {
  const mergedReverse = { ...maps.aliasToDataframe, ...maps.aliasToColumn };
  const steps = plan.steps.map((step) => {
    if (step.stepType === 'code') {
      return {
        ...step,
        script: deAliasScript(step.script, maps),
      };
    }
    return {
      ...step,
      state: deAliasUnknown(step.state, mergedReverse) as Record<string, unknown>,
    };
  });

  return {
    ...plan,
    steps,
  };
}

export function deAliasScript(script: string, maps: AliasMaps): string {
  let output = script;
  const reverse = Object.entries({ ...maps.aliasToDataframe, ...maps.aliasToColumn }).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, original] of reverse) {
    const rx = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'g');
    output = output.replace(rx, original);
  }
  return output;
}

export function buildPrivacyReport(redactedPatterns: string[], maps: AliasMaps): PrivacyReport {
  const aliasedDataframes = Object.keys(maps.dataframeToAlias).length;
  const aliasedColumns = Object.values(maps.columnToAliasByDataframe).reduce(
    (total, record) => total + Object.keys(record).length,
    0
  );
  return {
    redactedPatterns,
    aliasedDataframes,
    aliasedColumns,
  };
}

function deAliasUnknown(value: unknown, reverse: Record<string, string>): unknown {
  if (typeof value === 'string') {
    return reverse[value] ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deAliasUnknown(item, reverse));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, deAliasUnknown(val, reverse)])
    );
  }
  return value;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
