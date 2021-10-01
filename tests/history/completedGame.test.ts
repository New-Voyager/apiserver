import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {completedGame} from './utils';

describe('completedGame APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('completedGame', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);

    // need to check resolver
    try {
      const data = await completedGame({
        ownerId,
        gameCode: 'test',
      });
    } catch (error) {
      expect(error).not.toBeNull();
    }
  });
});
