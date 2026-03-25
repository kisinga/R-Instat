/**
 * Rule-based categorizer strategy (pure, synchronous).
 * Evaluated first in the categorizer chain; returns null when no rule matches.
 * Order aligns with CLASSIFICATION_SYSTEM: education before open_dialog for explanation intents.
 */

import type { DialogFamily } from './dialog-catalog';
import type { CategorizerResult } from './pipeline-types';

const EDUCATION_PROBES = [
  'what is',
  'what are',
  'explain',
  'how does',
  'how do',
  'what does',
  'tell us',
  'why do we',
  'why does',
  'explain what',
  'meaning of',
  'understand',
  'difference between',
  'when should i use',
  'when to use',
  'help me understand',
  'can you explain',
  'teach me',
  'what is the purpose of',
  'assumptions of',
  'how to interpret',
  'how to read',
  'what does it mean when',
  'define ',
  'definition of',
  'in simple terms',
  'basics of',
  'fundamentals of',
  'concept of',
  'introduction to',
];

/** Action-intent phrases that override education classification when co-occurring. */
const ACTION_OVERRIDE_PROBES = [
  'perform',
  'run a',
  'create a',
  'make a',
  'do a',
  'show me a',
  'generate a',
  'plot a',
  'on my data',
  'using my',
  'with my data',
];

const RUN_CODE_PROBES = [
  'write r code',
  'write r script',
  'r code',
  'r script',
  'give me a script',
  'give me code',
  'custom model',
  'run this code',
  'run code',
  'glm(',
  'lm(',
];

const DATA_QUALITY_PROBES = [
  'missing',
  'data quality',
  'gaps',
  'completeness',
  'effectiveness workflow',
  'quality workflow',
  'missing data',
];

const REFINE_PROBES = [
  'use a different column',
  'use different column',
  'add a facet',
  'add facet',
  'change the x axis',
  'change the y axis',
  'change x axis',
  'change y axis',
  'do that',
  'same but',
  'same with',
  'different column',
];

/** (phrase probes, family) for open_dialog. Check normalized input with .includes(probe). */
const OPEN_DIALOG_PHRASES: Array<{ probes: string[]; family: DialogFamily }> = [
  { probes: ['bar chart', 'bar plot', 'bars ', ' bars'], family: 'plotting' },
  { probes: ['histogram'], family: 'plotting' },
  { probes: ['boxplot', 'box plot'], family: 'plotting' },
  { probes: ['scatter', 'scatter plot'], family: 'plotting' },
  { probes: ['t-test', 'ttest', 't test'], family: 'inferential' },
  { probes: ['regression', 'linear model'], family: 'predictive' },
  { probes: ['filter', 'subset', 'subset rows'], family: 'data-preparation' },
  { probes: ['sort', 'order by'], family: 'data-preparation' },
  { probes: ['correlation'], family: 'inferential' },
  { probes: ['calculate', 'new column', 'derived column'], family: 'data-preparation' },
  { probes: ['rename', 'rename column'], family: 'data-preparation' },
  { probes: ['recode', 'recode column'], family: 'data-preparation' },
  { probes: ['summary', 'summarise', 'summarize'], family: 'plotting' },
];

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

function hasAny(input: string, probes: string[]): boolean {
  return probes.some((p) => input.includes(p));
}

/**
 * Rule-based categorizer strategy. Returns null when no rule matches (or intent is ambiguous).
 */
export function ruleBasedCategorizer(
  input: string,
  hasCurrentDialog: boolean
): CategorizerResult | null {
  const norm = normalize(input);
  if (!norm || norm.length < 2) {
    return null;
  }

  // 1. education_question first (so "explain what a t-test" is not open_dialog)
  //    But defer to LLM if the user also shows action intent (e.g. "on my data")
  if (hasAny(norm, EDUCATION_PROBES)) {
    if (hasAny(norm, ACTION_OVERRIDE_PROBES)) {
      return null; // ambiguous — let LLM categorizer decide
    }
    return { category: 'education_question' };
  }

  // 2. run_code – explicit script/code intent
  if (hasAny(norm, RUN_CODE_PROBES)) {
    return { category: 'run_code' };
  }

  // 3. data_quality_recipe
  if (hasAny(norm, DATA_QUALITY_PROBES)) {
    return { category: 'data_quality_recipe' };
  }

  // 4. refine_current_dialog – only when a dialog is open
  if (hasCurrentDialog && hasAny(norm, REFINE_PROBES)) {
    return { category: 'refine_current_dialog' };
  }

  // 5. open_dialog + family – high-confidence phrases only
  for (const { probes, family } of OPEN_DIALOG_PHRASES) {
    if (hasAny(norm, probes)) {
      return { category: 'open_dialog', family };
    }
  }

  return null;
}
