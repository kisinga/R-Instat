import { ruleBasedCategorizer } from './categorizer-rules';

describe('categorizer-rules', () => {
  describe('education_question', () => {
    it('returns education_question for explain/what is/how does probes', () => {
      expect(ruleBasedCategorizer('What is a t-test?', false)).toEqual({
        category: 'education_question',
      });
      expect(ruleBasedCategorizer('Explain regression', false)).toEqual({
        category: 'education_question',
      });
      expect(ruleBasedCategorizer('How does a t-test work?', false)).toEqual({
        category: 'education_question',
      });
      expect(ruleBasedCategorizer('Explain what a t-test tells us', false)).toEqual({
        category: 'education_question',
      });
    });

    it('takes precedence over open_dialog for explanation intent', () => {
      expect(ruleBasedCategorizer('explain what a t-test tells us', false)).toEqual({
        category: 'education_question',
      });
    });
  });

  describe('run_code', () => {
    it('returns run_code for explicit script/code intent', () => {
      expect(ruleBasedCategorizer('Write R code for a histogram', false)).toEqual({
        category: 'run_code',
      });
      expect(ruleBasedCategorizer('Give me a script', false)).toEqual({
        category: 'run_code',
      });
      expect(ruleBasedCategorizer('I need glm() for this', false)).toEqual({
        category: 'run_code',
      });
    });
  });

  describe('data_quality_recipe', () => {
    it('returns data_quality_recipe for quality/missing probes', () => {
      expect(ruleBasedCategorizer('Show missing data', false)).toEqual({
        category: 'data_quality_recipe',
      });
      expect(ruleBasedCategorizer('Data quality workflow', false)).toEqual({
        category: 'data_quality_recipe',
      });
    });
  });

  describe('refine_current_dialog', () => {
    it('returns refine_current_dialog only when hasCurrentDialog and refine phrases', () => {
      expect(ruleBasedCategorizer('Use a different column', true)).toEqual({
        category: 'refine_current_dialog',
      });
      expect(ruleBasedCategorizer('Add a facet', true)).toEqual({
        category: 'refine_current_dialog',
      });
      expect(ruleBasedCategorizer('Do that', true)).toEqual({
        category: 'refine_current_dialog',
      });
    });

    it('returns null for refine phrases when no dialog open', () => {
      expect(ruleBasedCategorizer('Use a different column', false)).toBeNull();
    });
  });

  describe('open_dialog + family', () => {
    it('returns open_dialog with family for high-confidence phrases', () => {
      expect(ruleBasedCategorizer('Create a bar chart', false)).toEqual({
        category: 'open_dialog',
        family: 'plotting',
      });
      expect(ruleBasedCategorizer('Run a t-test', false)).toEqual({
        category: 'open_dialog',
        family: 'inferential',
      });
      expect(ruleBasedCategorizer('Filter rows', false)).toEqual({
        category: 'open_dialog',
        family: 'data-preparation',
      });
      expect(ruleBasedCategorizer('Linear regression', false)).toEqual({
        category: 'open_dialog',
        family: 'predictive',
      });
      expect(ruleBasedCategorizer('Sort by column', false)).toEqual({
        category: 'open_dialog',
        family: 'data-preparation',
      });
    });
  });

  describe('null when no rule matches', () => {
    it('returns null for empty or very short input', () => {
      expect(ruleBasedCategorizer('', false)).toBeNull();
      expect(ruleBasedCategorizer('  ', false)).toBeNull();
      expect(ruleBasedCategorizer('x', false)).toBeNull();
    });

    it('returns null for ambiguous or vague input', () => {
      expect(ruleBasedCategorizer('something', false)).toBeNull();
      expect(ruleBasedCategorizer('help me', false)).toBeNull();
    });
  });
});
