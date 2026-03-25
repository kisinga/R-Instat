import type { ResolverTransform } from '../../services/intent-resolver.pipeline';

export function createNormalizeFilterLogicTransform(): ResolverTransform {
  return {
    id: 'normalize-filter-combine-logic',
    scope: 'dialog',
    dialogId: 'filter',
    run: (_dialogId, _params, state, _dataContext, _warnings) => {
      const normalized = { ...state };
      const combineLogic = normalized['combineLogic'];
      if (combineLogic === 'and') {
        normalized['combineLogic'] = '&';
      } else if (combineLogic === 'or') {
        normalized['combineLogic'] = '|';
      }
      return normalized;
    },
  };
}
