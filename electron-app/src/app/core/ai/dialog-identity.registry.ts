import {
  getDialogContractsForPrompt,
  getSchema,
} from './dialog-catalog-aggregator';

export { getDialogContractsForPrompt };

/** Non–DialogBase dialogs: identity only (Describe, Import, etc.). */
const OTHER_DIALOG_IDENTITY: Readonly<Record<string, string>> = {
  'import': 'ImportDialogComponent',
  'describe': 'DescribeDialogComponent',
  'describe:summary': 'SummaryDialogComponent',
  'describe:graph': 'DescribeDialogComponent',
  'domain-selector': 'DomainSelectorComponent',
  'define-climatic-data': 'DefineClimaticDataDialogComponent',
  'export': 'ExportDialogComponent',
  'ai-assist': 'AIAssistDialogComponent',
};

let _identityMap: Readonly<Record<string, string>> | null = null;
let _componentToDialogId: Map<string, string> | null = null;

function ensureIdentity(): Readonly<Record<string, string>> {
  if (_identityMap === null) {
    const catalog = getDialogContractsForPrompt();
    const map: Record<string, string> = { ...OTHER_DIALOG_IDENTITY };
    for (const c of catalog) {
      map[c.dialogId] = c.componentType;
    }
    _identityMap = map;
    _componentToDialogId = new Map<string, string>();
    for (const [dialogId, componentType] of Object.entries(_identityMap)) {
      if (!_componentToDialogId.has(componentType)) {
        _componentToDialogId.set(componentType, dialogId);
      }
    }
  }
  return _identityMap;
}

export function getDialogIdToComponent(): Readonly<Record<string, string>> {
  return ensureIdentity();
}

/** @deprecated Use getDialogIdToComponent() to avoid circular dependency at module load. */
export const DIALOG_ID_TO_COMPONENT: Readonly<Record<string, string>> = new Proxy(
  {} as Record<string, string>,
  {
    get(_, prop: string | symbol) {
      return typeof prop === 'string' ? ensureIdentity()[prop] : undefined;
    },
    ownKeys() {
      return Reflect.ownKeys(ensureIdentity());
    },
    getOwnPropertyDescriptor(_, prop: string | symbol) {
      const value = typeof prop === 'string' ? ensureIdentity()[prop] : undefined;
      return { enumerable: true, configurable: true, value };
    },
  }
);

const NON_ANALYTICAL_DIALOGS = new Set<string>([
  'import',
  'export',
  'domain-selector',
  'restore-from-code',
  'ai-assist',
]);

function normalizeComponentType(componentType: string): string {
  return componentType.startsWith('_') ? componentType.slice(1) : componentType;
}

export function getComponentType(dialogId: string): string | undefined {
  return ensureIdentity()[dialogId];
}

export function getDialogId(componentType: string): string | null {
  ensureIdentity();
  const normalized = normalizeComponentType(componentType);
  return _componentToDialogId!.get(normalized) ?? null;
}

export function isKnownDialogId(dialogId: string): boolean {
  return Object.prototype.hasOwnProperty.call(ensureIdentity(), dialogId);
}

export function listDialogIds(opts: { includeNonAnalytical?: boolean } = {}): string[] {
  const { includeNonAnalytical = true } = opts;
  const dialogIds = Object.keys(ensureIdentity());
  if (includeNonAnalytical) {
    return dialogIds;
  }
  return dialogIds.filter((dialogId) => !NON_ANALYTICAL_DIALOGS.has(dialogId));
}

export function getDialogContract(dialogId: string): {
  dialogId: string;
  componentType: string;
  schema: ReturnType<typeof getSchema>;
} | null {
  const componentType = getComponentType(dialogId);
  if (!componentType) {
    return null;
  }
  return {
    dialogId,
    componentType,
    schema: getSchema(dialogId),
  };
}
