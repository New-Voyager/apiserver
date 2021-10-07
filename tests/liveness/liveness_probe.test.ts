import {runLivenessProbe} from '../utils/utils';

describe('Liveness Check - Liveness probe must not fail or time out', () => {
  beforeAll(async done => {
    done();
  });

  afterAll(async done => {
    done();
  });
  test('Run Liveness Probe', async () => {
    await runLivenessProbe();
  });
});
