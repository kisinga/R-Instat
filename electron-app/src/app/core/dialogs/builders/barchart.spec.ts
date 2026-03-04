import { buildBarChart } from './barchart';
import { extractMetadata } from '../../r-codegen/metadata-parser';

describe('buildBarChart', () => {
  it('builds frequency chart with expected ggplot clauses', () => {
    const syntax = buildBarChart({
      type: 'frequency',
      dataframe: 'df1',
      xVariable: 'species',
      fillVariable: 'island',
      position: 'dodge',
      horizontal: true,
      title: 'My Frequency Bar',
      name: 'bar_plot_freq',
    });

    const script = syntax.toScript();
    expect(script).toContain('ggplot(data = df1');
    expect(script).toContain('x = species');
    expect(script).toContain('fill = island');
    expect(script).toContain('stat = "count"');
    expect(script).toContain('position = "dodge"');
    expect(script).toContain('coord_flip()');
    expect(script).toContain('title = "My Frequency Bar"');
    expect(script).toContain('graph$bar_plot_freq');
  });

  it('builds value chart with expected identity stat and y mapping', () => {
    const syntax = buildBarChart({
      type: 'value',
      dataframe: 'df1',
      xVariable: 'species',
      yVariable: 'count',
      position: 'fill',
      horizontal: false,
      title: 'My Value Bar',
      name: 'bar_plot_value',
    });

    const script = syntax.toScript();
    expect(script).toContain('x = species');
    expect(script).toContain('y = count');
    expect(script).toContain('stat = "identity"');
    expect(script).toContain('position = "fill"');
    expect(script).toContain('title = "My Value Bar"');
    expect(script).toContain('graph$bar_plot_value');
  });

  it('roundtrips bar-chart metadata in generated script', () => {
    const metadata = {
      dialogId: 'bar-chart',
      componentType: 'BarChartDialogComponent',
      version: '1.0',
      state: {
        dataframe: 'df1',
        chartType: 'value',
        xVariable: 'species',
        yVariable: 'count',
        fillVariable: 'island',
        position: 'stack',
        horizontal: false,
        title: 'Core parity test',
        outputName: 'bar_plot',
      },
      timestamp: '2026-01-01T00:00:00.000Z',
    };

    const script = buildBarChart({
      type: 'value',
      dataframe: 'df1',
      xVariable: 'species',
      yVariable: 'count',
      fillVariable: 'island',
      position: 'stack',
      title: 'Core parity test',
      name: 'bar_plot',
    })
      .setMetadata(metadata)
      .toScript();

    const parsed = extractMetadata(script);
    expect(parsed).toEqual(metadata);
  });
});
