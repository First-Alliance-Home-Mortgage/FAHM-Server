jest.mock('axios');

jest.resetModules();
const optimalBlueService = require('../../src/services/optimalBlueService');
const axios = require('axios');

const mockRateResponse = {
  data: {
    rates: [
      {
        rateId: 'r1',
        productType: 'CONV',
        term: 30,
        loanPurpose: 'PURCHASE',
        interestRate: 6.5,
        apr: 6.7,
      },
    ],
  },
};

describe('optimalBlueService.getRateSheetCached', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ data: { access_token: 'token123', expires_in: 3600 } });
    axios.mockResolvedValue(mockRateResponse);
  });

  it('caches rate sheet by scenario key', async () => {
    const scenario = { loanAmount: 300000, productType: 'conventional', loanTerm: 30 };

    const first = await optimalBlueService.getRateSheetCached(scenario, 10_000);
    const second = await optimalBlueService.getRateSheetCached(scenario, 10_000);

    expect(first).toEqual(second);
    expect(axios).toHaveBeenCalledTimes(1);
  });

  it('misses cache when ttl expired', async () => {
    const scenario = { loanAmount: 400000, productType: 'conventional', loanTerm: 30 };

    await optimalBlueService.getRateSheetCached(scenario, 1);
    await new Promise((r) => setTimeout(r, 5));
    await optimalBlueService.getRateSheetCached(scenario, 1);

    expect(axios).toHaveBeenCalledTimes(2);
  });
});
