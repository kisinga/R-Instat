/**
 * Shared DataContext builder.
 *
 * Extracts the duplicated buildDataContext() logic from
 * education-tab.component.ts and ai-assist-dialog.component.ts
 * into a single injectable service.
 */

import { Injectable, inject } from '@angular/core';
import { RService } from './r.service';
import type { DataContext } from '../ai/types/data-context.types';

@Injectable({ providedIn: 'root' })
export class DataContextBuilder {
  private readonly rService = inject(RService);

  async build(): Promise<DataContext> {
    const dataframes = this.rService.dataframes();
    const active = this.rService.activeDataframe();
    const columnsByDataframe: Record<string, Array<{ name: string; type: string }>> = {};

    for (const df of dataframes) {
      try {
        const colInfo = await this.rService.getColumnInfo(df);
        columnsByDataframe[df] = colInfo.map(c => ({ name: c.name, type: c.type }));
      } catch {
        columnsByDataframe[df] = [];
      }
    }

    const df = active && dataframes.includes(active) ? active : dataframes[0] ?? null;
    return { dataframes, activeDataframe: df, columnsByDataframe };
  }
}
