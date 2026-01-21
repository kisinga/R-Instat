/**
 * Dialog Builder Service
 *
 * Centralized service providing domain-specific R code builders for dialogs.
 * Builders are pure, composable functions that return RSyntax instances.
 *
 * This service is injectable and provides type-safe builders for:
 * - Graph dialogs (bar chart, histogram, scatter, etc.)
 * - Data manipulation dialogs
 * - Statistical analysis dialogs
 */

import { Injectable } from '@angular/core';
import { RSyntax, rSyntax, rFn, rStr, rPlus, rIf, rAssign } from '../../r-codegen';
import { ggBase, ggAes, ggFacet, ggFlip, ggTheme, ggLabs } from '../../r-codegen/ggplot-helpers';

/**
 * Bar Chart Options
 */
export interface BarChartOptions {
  dataframe: string;
  xVariable: string;
  fillVariable?: string;
  position?: 'stack' | 'dodge' | 'fill';
  horizontal?: boolean;
  title?: string;
  name?: string; // Output graph name
}

@Injectable({ providedIn: 'root' })
export class DialogBuilderService {
  /**
   * Build R code for a bar chart
   *
   * @param options - Bar chart configuration
   * @returns RSyntax instance with ggplot2 code
   */
  buildBarChart(options: BarChartOptions): RSyntax {
    if (!options.dataframe) {
      return rSyntax().setBase('# Select a dataframe first');
    }

    if (!options.xVariable) {
      return rSyntax().setBase('# Select an X variable');
    }

    const aesMappings: Record<string, string | undefined> = {
      x: options.xVariable,
      fill: options.fillVariable,
    };

    const baseCode = rPlus(
      ggBase(options.dataframe, ggAes(aesMappings)),
      rFn('geom_bar', {
        position: rStr(options.position || 'stack'),
        alpha: '0.8',
      }),
      options.horizontal ? ggFlip(true) : undefined,
      ggTheme(),
      ggLabs({
        title: options.title || `Bar Chart of ${options.xVariable}`,
        x: options.xVariable,
        y: 'Count',
      })
    );

    let syntax = rSyntax().setBase(baseCode);

    // Set assignment if output name provided
    if (options.name) {
      syntax = syntax.setAssignment(
        rAssign('graph', options.name, {
          format: 'text',
        })
      );
    }

    return syntax;
  }
}
