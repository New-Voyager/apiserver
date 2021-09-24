import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {systemStats} from './utils';

describe('systemStats APIs', () => {
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
  test('systemStats', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);

    const data = await systemStats({
      ownerId,
      gameType: 'HOLDEM',
    });
    expect(data.systemStats.straight5Flush).toEqual(0);
  });
});
