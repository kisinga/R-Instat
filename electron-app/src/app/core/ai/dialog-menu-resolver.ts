/**
 * Dialog Menu Resolver — Derives dialog menu paths from toolbar menu structure.
 *
 * Walks the toolbar menu groups to build a map of dialogId → { label, path }.
 * Uses a translate function to resolve i18n keys to display strings.
 */

export interface MenuItemLike {
  labelKey: string;
  action: string;
}

export interface MenuGroupLike {
  labelKey: string;
  items: MenuItemLike[];
}

export class DialogMenuResolver {
  private readonly map = new Map<string, { label: string; path: string[] }>();

  constructor(menus: MenuGroupLike[], translate: (key: string) => string) {
    for (const group of menus) {
      const groupLabel = translate(group.labelKey);
      for (const item of group.items) {
        const itemLabel = translate(item.labelKey);
        this.map.set(item.action, {
          label: itemLabel,
          path: [groupLabel, itemLabel],
        });
      }
    }
  }

  resolve(dialogId: string): { label: string; path: string[] } | undefined {
    return this.map.get(dialogId);
  }
}

/**
 * Standard menu groups mirroring ToolbarComponent.staticMenus.
 * Shared between EducationTabComponent and AIAssistDialogComponent.
 */
export const STANDARD_MENU_GROUPS: MenuGroupLike[] = [
  {
    labelKey: 'TOOLBAR.MENU_DATA',
    items: [
      { labelKey: 'TOOLBAR.FILTER', action: 'filter' },
      { labelKey: 'TOOLBAR.SORT', action: 'sort' },
      { labelKey: 'TOOLBAR.CALCULATE', action: 'calculate' },
      { labelKey: 'TOOLBAR.RECODE', action: 'recode' },
      { labelKey: 'TOOLBAR.RENAME', action: 'rename' },
      { labelKey: 'TOOLBAR.STACK', action: 'stack' },
      { labelKey: 'TOOLBAR.UNSTACK', action: 'unstack' },
      { labelKey: 'TOOLBAR.MERGE', action: 'merge' },
    ],
  },
  {
    labelKey: 'TOOLBAR.MENU_ANALYZE',
    items: [
      { labelKey: 'TOOLBAR.DESCRIBE', action: 'describe' },
      { labelKey: 'TOOLBAR.SUMMARY', action: 'summary' },
    ],
  },
  {
    labelKey: 'TOOLBAR.MENU_VISUALIZE',
    items: [
      { labelKey: 'TOOLBAR.HISTOGRAM', action: 'histogram' },
      { labelKey: 'TOOLBAR.BOX_PLOT', action: 'boxplot' },
      { labelKey: 'TOOLBAR.SCATTER', action: 'scatter' },
      { labelKey: 'TOOLBAR.BAR_CHART', action: 'bar-chart' },
      { labelKey: 'TOOLBAR.LINE_PLOT', action: 'line-plot' },
      { labelKey: 'TOOLBAR.DOT_PLOT', action: 'dot-plot' },
    ],
  },
  {
    labelKey: 'TOOLBAR.MENU_MODEL',
    items: [
      { labelKey: 'TOOLBAR.CORRELATION', action: 'correlation' },
      { labelKey: 'TOOLBAR.TTEST', action: 't-test' },
      { labelKey: 'TOOLBAR.REGRESSION', action: 'regression' },
    ],
  },
];
