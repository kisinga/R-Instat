/**
 * Date Conversion Service
 * 
 * Handles on-demand conversion of character columns to R Date type.
 * Provides format detection and conversion via R's as.Date().
 */

import { Injectable, inject } from '@angular/core';
import { RService } from './r.service';

/** Common date formats to try for auto-detection */
const DATE_FORMATS = [
  '%Y-%m-%d',    // ISO: 2024-01-15
  '%d/%m/%Y',    // EU: 15/01/2024
  '%m/%d/%Y',    // US: 01/15/2024
  '%Y/%m/%d',    // Alt ISO: 2024/01/15
  '%d-%m-%Y',    // EU dash: 15-01-2024
  '%d.%m.%Y',    // EU dot: 15.01.2024
];

@Injectable({ providedIn: 'root' })
export class DateConversionService {
  private readonly rService = inject(RService);

  /**
   * Convert a character column to Date type in R
   * 
   * @param dataframe - Name of the dataframe
   * @param column - Name of the column to convert
   * @param format - Optional date format (auto-detected if not provided)
   * @returns Promise resolving to success/failure
   */
  async convertToDate(
    dataframe: string,
    column: string,
    format?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Build R code for conversion
      const code = format
        ? this.buildConversionCode(dataframe, column, format)
        : this.buildAutoConversionCode(dataframe, column);

      const result = await this.rService.execute(code, true);
      
      if (result.success) {
        // Refresh dataframes to update column types
        await this.rService.refreshDataframes();
        return { success: true };
      }
      
      return { success: false, error: result.error };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Conversion failed',
      };
    }
  }

  /**
   * Check if a column needs date conversion (is character type)
   */
  async needsConversion(dataframe: string, column: string): Promise<boolean> {
    try {
      const columnInfo = await this.rService.getColumnInfo(dataframe);
      const col = columnInfo.find(c => c.name === column);
      return col?.type === 'character';
    } catch {
      return false;
    }
  }

  /**
   * Ensure a column is Date type, converting if necessary
   */
  async ensureDateColumn(
    dataframe: string,
    column: string
  ): Promise<{ success: boolean; converted: boolean; error?: string }> {
    const needsConv = await this.needsConversion(dataframe, column);
    
    if (!needsConv) {
      return { success: true, converted: false };
    }

    const result = await this.convertToDate(dataframe, column);
    return { ...result, converted: result.success };
  }

  /**
   * Build R code for date conversion with specific format
   */
  private buildConversionCode(dataframe: string, column: string, format: string): string {
    return `
data_store[["${dataframe}"]][["${column}"]] <- as.Date(
  data_store[["${dataframe}"]][["${column}"]],
  format = "${format}"
)
`.trim();
  }

  /**
   * Build R code for auto-detecting date format and converting
   * Tries common formats until one works
   */
  private buildAutoConversionCode(dataframe: string, column: string): string {
    const formats = DATE_FORMATS.map(f => `"${f}"`).join(', ');
    
    return `
local({
  df <- data_store[["${dataframe}"]]
  col <- df[["${column}"]]
  
  if (inherits(col, "Date") || inherits(col, "POSIXt")) {
    return(invisible(NULL))  # Already a date
  }
  
  formats <- c(${formats})
  sample_val <- na.omit(col)[1]
  
  converted <- NULL
  for (fmt in formats) {
    test <- tryCatch(
      as.Date(sample_val, format = fmt),
      error = function(e) NA
    )
    if (!is.na(test)) {
      converted <- as.Date(col, format = fmt)
      break
    }
  }
  
  if (is.null(converted)) {
    # Fallback: let R auto-detect
    converted <- as.Date(col)
  }
  
  data_store[["${dataframe}"]][["${column}"]] <- converted
  invisible(NULL)
})
`.trim();
  }

  /**
   * Get R code for date extraction (year, month, doy)
   * These are composable code snippets for use in R builders
   */
  static extractYear(column: string): string {
    return `lubridate::year(${column})`;
  }

  static extractMonth(column: string): string {
    return `lubridate::month(${column})`;
  }

  static extractDoy(column: string): string {
    return `lubridate::yday(${column})`;
  }
}
