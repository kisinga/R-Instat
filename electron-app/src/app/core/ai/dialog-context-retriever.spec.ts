import { DialogContractV2Registry } from './dialog-contract-v2.registry';
import { retrieveDialogContractsTopK } from './dialog-context-retriever';

describe('dialog context retriever', () => {
  it('ranks plotting contracts for plotting intent', () => {
    const candidates = retrieveDialogContractsTopK(
      'Create a bar chart of counts by species',
      DialogContractV2Registry.getPromptContracts(),
      {
        activeDataframe: 'df1',
        columnsByDataframe: {
          df1: [
            { name: 'species', type: 'factor' },
            { name: 'count', type: 'numeric' },
          ],
        },
      },
      2
    );

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].dialogId).toBe('bar-chart');
    expect(candidates[0].score).toBeGreaterThan(0);
    expect(candidates[0].reasons.length).toBeGreaterThan(0);
  });
});
