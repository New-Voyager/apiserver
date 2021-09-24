import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {playerHandStats} from './utils';

describe('playerHandStats APIs', () => {
  let stop;

  beforeAll(async done => {
    const testServer = await startGqlServer();
    stop = testServer.stop;
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    stop();
    done();
  });
  test('playerHandStats', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);

    const data = await playerHandStats({ownerId});
    expect(data.playerHandStats.inPreflop).toEqual(0);
  });
});
