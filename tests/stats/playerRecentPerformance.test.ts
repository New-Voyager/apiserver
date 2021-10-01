import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {clubStats, playerRecentPerformance} from './utils';

describe('playerRecentPerformance APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('playerRecentPerformance', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);

    const data = await playerRecentPerformance({
      ownerId,
    });
    console.log(data);
    expect(data.playerRecentPerformance).toEqual([]);
  });
});
