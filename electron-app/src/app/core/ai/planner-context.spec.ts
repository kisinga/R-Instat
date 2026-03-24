import '../../features/dialogs/dialog-host.component';
import {
  filterOperationsForScopedDialogs,
  buildPlanningContractViews,
} from './planner-context';
import { OPERATION_REGISTRY } from './operation-registry';
import { getSchema } from './dialog-catalog-aggregator';
import { getDialogContractsForPrompt } from './dialog-identity.registry';

describe('planner-context', () => {
  describe('filterOperationsForScopedDialogs', () => {
    it('returns only operations whose mappedDialogs intersect scopedDialogIds', () => {
      const scoped = ['filter', 'sort'];
      const result = filterOperationsForScopedDialogs(OPERATION_REGISTRY, scoped);
      expect(result.length).toBeLessThanOrEqual(OPERATION_REGISTRY.length);
      result.forEach((op) => {
        const hasOverlap = op.mappedDialogs.some((id) => scoped.includes(id));
        expect(hasOverlap).toBe(true);
      });
    });

    it('returns empty when scopedDialogIds is empty', () => {
      const result = filterOperationsForScopedDialogs(OPERATION_REGISTRY, []);
      expect(result).toEqual([]);
    });

    it('returns all operations that map to any of the scoped dialogs', () => {
      const scoped = ['bar-chart', 'histogram'];
      const result = filterOperationsForScopedDialogs(OPERATION_REGISTRY, scoped);
      const ids = result.map((r) => r.id);
      expect(ids).toContain('describe.distribution.numeric');
      expect(ids).toContain('describe.comparison.numeric_by_group');
    });
  });

  describe('buildPlanningContractViews', () => {
    it('returns compact views with dialogId, description, operations, paramNames only', () => {
      const contracts = getDialogContractsForPrompt().slice(0, 3);
      const views = buildPlanningContractViews(contracts, getSchema);
      expect(views.length).toBe(contracts.length);
      views.forEach((v) => {
        expect(v).toHaveProperty('dialogId');
        expect(v).toHaveProperty('description');
        expect(v).toHaveProperty('operations');
        expect(v).toHaveProperty('paramNames');
        expect(Array.isArray(v.paramNames)).toBe(true);
        expect(v).not.toHaveProperty('params');
        expect(Object.keys(v).length).toBe(4);
      });
    });

    it('derives paramNames from schema', () => {
      const contracts = getDialogContractsForPrompt().filter(
        (c) => c.dialogId === 'bar-chart'
      );
      const views = buildPlanningContractViews(contracts, getSchema);
      expect(views.length).toBe(1);
      const schema = getSchema('bar-chart');
      expect(views[0].paramNames).toEqual(schema!.params.map((p) => p.name));
    });

    it('uses empty paramNames when getSchema returns undefined', () => {
      const contracts = getDialogContractsForPrompt().slice(0, 1);
      const views = buildPlanningContractViews(contracts, () => undefined);
      expect(views[0].paramNames).toEqual([]);
    });
  });
});
