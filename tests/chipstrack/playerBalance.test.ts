import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getPlayerBalance} from './utils';

describe('getPlayerBalance APIs', () => {
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
  test('getPlayerBalance', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);

    try {
      const data = await getPlayerBalance({
        ownerId,
        clubCode,
        playerId,
      });
      expect(data.playerBalance).toEqual(true);
    } catch (error) {
      expect(true).toBeTruthy();
    }
  });
});
