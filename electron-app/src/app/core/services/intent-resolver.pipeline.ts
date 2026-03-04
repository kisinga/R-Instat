import type { DialogParamSchema } from '../ai/dialog-schema.registry';
import type { DataContext } from './ai-client.service';
import { getCatalogContract } from '../ai/dialog-catalog-aggregator';

export type ResolverTransformScope = 'global' | 'family' | 'dialog';

export interface ResolverTransform {
  id: string;
  scope: ResolverTransformScope;
  family?: string;
  dialogId?: string;
  run: (
    dialogId: string,
    params: DialogParamSchema[],
    state: Record<string, unknown>,
    dataContext: DataContext,
    warnings: string[]
  ) => Record<string, unknown>;
}

export interface ResolverPipelineDiagnostics {
  appliedTransformIds: string[];
}

export class ResolverTransformPipeline {
  constructor(private readonly transforms: ResolverTransform[]) {}

  apply(
    dialogId: string,
    params: DialogParamSchema[],
    initialState: Record<string, unknown>,
    dataContext: DataContext,
    warnings: string[]
  ): { state: Record<string, unknown>; diagnostics: ResolverPipelineDiagnostics } {
    const family = getCatalogContract(dialogId)?.family;
    let state = { ...initialState };
    const appliedTransformIds: string[] = [];

    for (const transform of this.transforms) {
      if (!this.matchesScope(transform, dialogId, family)) {
        continue;
      }
      state = transform.run(dialogId, params, state, dataContext, warnings);
      appliedTransformIds.push(transform.id);
    }

    return {
      state,
      diagnostics: { appliedTransformIds },
    };
  }

  private matchesScope(transform: ResolverTransform, dialogId: string, family?: string): boolean {
    if (transform.scope === 'global') {
      return true;
    }
    if (transform.scope === 'family') {
      return !!transform.family && transform.family === family;
    }
    return !!transform.dialogId && transform.dialogId === dialogId;
  }
}
