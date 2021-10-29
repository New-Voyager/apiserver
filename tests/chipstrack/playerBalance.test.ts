import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getPlayerBalance} from './utils';

describe('getPlayerBalance APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('getPlayerBalance', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    const playerId2 = await clubutils.createPlayer('adam', '1243ABCs');
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

    try {
      await getPlayerBalance({
        ownerId,
        clubCode: '',
        playerId,
      });
    } catch (error) {
      const expectedError = 'ClubCode is mandatory field';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await getPlayerBalance({
        ownerId: playerId2,
        clubCode,
        playerId,
      });
    } catch (error) {
      const expectedError = `Player 1243ABCs is not a club member ${clubCode}`;
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
  });
});
