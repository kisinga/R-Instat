import type { DialogPromptContractV2, DialogFamily } from './dialog-contract-v2';

export interface RetrievalDataContext {
  activeDataframe: string | null;
  columnsByDataframe: Record<string, Array<{ name: string; type: string }>>;
}

export interface RetrievedDialogCandidate extends DialogPromptContractV2 {
  score: number;
  reasons: string[];
}

/**
 * Run retrieval over contracts, optionally restricted to a dialog family.
 * When family is set, only contracts with contract.family === family are scored.
 */
export function retrieveDialogContractsTopK(
  userInput: string,
  contracts: DialogPromptContractV2[],
  dataContext: RetrievalDataContext,
  topK: number,
  family?: DialogFamily
): RetrievedDialogCandidate[] {
  const subset = family
    ? contracts.filter((c) => c.family === family)
    : contracts;
  return retrieveDialogContractsTopKInternal(userInput, subset, dataContext, topK);
}

function retrieveDialogContractsTopKInternal(
  userInput: string,
  contracts: DialogPromptContractV2[],
  dataContext: RetrievalDataContext,
  topK: number
): RetrievedDialogCandidate[] {
  const queryTokens = tokenize(userInput);
  const activeColumns = dataContext.activeDataframe
    ? dataContext.columnsByDataframe[dataContext.activeDataframe] ?? []
    : [];
  const hasNumeric = activeColumns.some((x) => mapColumnType(x.type) === 'numeric');
  const hasFactor = activeColumns.some((x) => mapColumnType(x.type) === 'factor');

  const scored = contracts.map((contract) => {
    let score = 0;
    const reasons: string[] = [];

    const dialogTokens = tokenize(contract.dialogId);
    const descriptionTokens = tokenize(contract.description);
    const operationTokens = contract.operations.flatMap((op) => tokenize(op));
    const keywordTokens = contract.retrievalHints.keywords.flatMap((keyword) => tokenize(keyword));

    const overlap = overlapCount(queryTokens, [...dialogTokens, ...descriptionTokens, ...operationTokens]);
    if (overlap > 0) {
      score += overlap * 1.2;
      reasons.push(`token overlap:${overlap}`);
    }

    const keywordOverlap = overlapCount(queryTokens, keywordTokens);
    if (keywordOverlap > 0) {
      score += keywordOverlap * 2.2;
      reasons.push(`keyword overlap:${keywordOverlap}`);
    }

    if (contract.family === 'plotting' && hasAny(queryTokens, ['plot', 'chart', 'graph', 'distribution'])) {
      score += 1.5;
      reasons.push('plotting intent');
    }

    const requiredColumnTypes = contract.params
      .filter((p) => p.required && p.kind === 'column' && p.columnType && p.columnType !== 'any')
      .map((p) => p.columnType);
    if (requiredColumnTypes.includes('numeric') && hasNumeric) {
      score += 0.8;
      reasons.push('numeric compatibility');
    }
    if (requiredColumnTypes.includes('factor') && hasFactor) {
      score += 0.8;
      reasons.push('factor compatibility');
    }

    return { ...contract, score, reasons };
  });

  const ranked = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, topK));

  // Conservative fallback: if all scores are near-zero, return full list.
  if (ranked.length > 0 && ranked[0].score < 1) {
    return contracts.map((contract) => ({
      ...contract,
      score: 0,
      reasons: ['fallback:low-confidence'],
    }));
  }

  return ranked;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

function overlapCount(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.reduce((count, token) => (setB.has(token) ? count + 1 : count), 0);
}

function hasAny(tokens: string[], probes: string[]): boolean {
  const tokenSet = new Set(tokens);
  return probes.some((probe) => tokenSet.has(probe));
}

function mapColumnType(rawType: string): 'numeric' | 'factor' | 'date' | 'any' {
  const t = rawType.toLowerCase();
  if (['numeric', 'integer', 'double'].some((x) => t.includes(x))) return 'numeric';
  if (['factor', 'character'].some((x) => t.includes(x))) return 'factor';
  if (['date', 'posix'].some((x) => t.includes(x))) return 'date';
  return 'any';
}
