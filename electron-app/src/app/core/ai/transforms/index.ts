import type { ResolverTransform } from '../../services/intent-resolver.pipeline';
import { createInferMissingFieldsTransform } from './infer-missing-fields.transform';
import { createNormalizeFilterLogicTransform } from './normalize-filter-logic.transform';
import { createNormalizeColumnRefsTransform } from './normalize-column-refs.transform';
import { createNormalizeBarChartTransform } from './normalize-bar-chart.transform';
import { createApplyParamAliasesTransform } from './apply-param-aliases.transform';

/** Default ordered set of resolver transforms. */
export function createDefaultTransforms(): ResolverTransform[] {
  return [
    createInferMissingFieldsTransform(),
    createNormalizeFilterLogicTransform(),
    createNormalizeColumnRefsTransform(),
    createNormalizeBarChartTransform(),
    createApplyParamAliasesTransform(),
  ];
}
