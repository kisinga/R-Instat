export type ExecutionMode = 'component_codegen' | 'structured_codegen' | 'direct_r';

export interface DataContext {
  dataframes: string[];
  activeDataframe: string | null;
  columnsByDataframe: Record<string, Array<{ name: string; type: string }>>;
}
