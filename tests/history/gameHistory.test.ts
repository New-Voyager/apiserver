import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {gameHistory} from './utils';

describe('gameHistory APIs', () => {
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
  test('gameHistory', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);

    // need to check resolver
    try {
      const data = await gameHistory({
        ownerId,
        clubCode,
      });
    } catch (error) {
      expect(error).not.toBeNull();
    }
  });
});
