import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getRakeCollected} from './utils';

describe('getRakeCollected APIs', () => {
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
  test('getRakeCollected', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);

    try {
      const data = await getRakeCollected({
        ownerId,
        clubCode,
        gameCode: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find game code [test] in poker game repo';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }
  });
});
