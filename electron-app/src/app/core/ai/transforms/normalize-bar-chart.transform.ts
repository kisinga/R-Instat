import type { ResolverTransform } from '../../services/intent-resolver.pipeline';

export function createNormalizeBarChartTransform(): ResolverTransform {
  return {
    id: 'plotting-normalize-bar-chart-state',
    scope: 'dialog',
    dialogId: 'bar-chart',
    run: (_dialogId, _params, state, _dataContext, warnings) => {
      const normalized = { ...state };
      const chartType = normalized['chartType'];
      const hasYVariable = typeof normalized['yVariable'] === 'string' && normalized['yVariable'] !== '';

      if (!chartType && hasYVariable) {
        normalized['chartType'] = 'value';
        warnings.push('Inferred "chartType" as "value" for bar-chart because "yVariable" is set');
      }

      if (normalized['chartType'] === 'frequency' && hasYVariable) {
        delete normalized['yVariable'];
        warnings.push('Removed "yVariable" for bar-chart because chartType is "frequency"');
      }

      return normalized;
    },
  };
}
