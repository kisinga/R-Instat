import type { ResolverTransform } from '../../services/intent-resolver.pipeline';
import { PARAM_ALIAS_CONFIG } from '../param-alias.config';

export function createApplyParamAliasesTransform(): ResolverTransform {
  return {
    id: 'param-aliases',
    scope: 'global',
    run: (dialogId, _params, state, _dataContext, warnings) => {
      const entries = PARAM_ALIAS_CONFIG.get(dialogId);
      if (!entries?.length) return state;
      const out = { ...state };
      for (const { alias, schemaKey } of entries) {
        const value = out[alias];
        if (value === undefined || value === null || value === '') continue;
        if (out[schemaKey] !== undefined && out[schemaKey] !== null && out[schemaKey] !== '') {
          delete (out as Record<string, unknown>)[alias];
          continue;
        }
        (out as Record<string, unknown>)[schemaKey] = value;
        warnings.push(`Mapped param "${alias}" → "${schemaKey}"`);
        delete (out as Record<string, unknown>)[alias];
      }
      return out;
    },
  };
}
