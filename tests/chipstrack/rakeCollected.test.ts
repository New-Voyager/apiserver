import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getRakeCollected} from './utils';

describe('getRakeCollected APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('getRakeCollected', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);

    try {
      await getRakeCollected({
        ownerId,
        clubCode,
        gameCode: 'test',
      });
    } catch (error) {
      const expectedError = 'Game test is not found';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await getRakeCollected({
        ownerId: undefined,
        clubCode,
        gameCode: 'test',
      });
    } catch (error) {
      const expectedError = 'Unauthorized';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
  });
});
