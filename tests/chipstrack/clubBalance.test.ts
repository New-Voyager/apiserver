import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getClubBalance} from './utils';

describe('getClubBalance APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('getClubBalance', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');

    const data = await getClubBalance({
      ownerId,
      clubCode,
    });
    expect(data.clubBalance.balance).toEqual(null);

    try {
      await getClubBalance({
        ownerId: undefined,
        clubCode,
      });
    } catch (error) {
      const expectedError = 'Unauthorized';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await getClubBalance({
        ownerId,
        clubCode: '',
      });
    } catch (error) {
      const expectedError = 'ClubCode is a mandatory field';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }
  });
});
