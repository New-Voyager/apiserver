import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {clubStats} from './utils';

describe('clubStats APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('clubStats', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, playerId);

    const data = await clubStats({
      ownerId,
      clubCode,
      gameType: 'HOLDEM',
    });
    console.log(data);
    expect(data.clubStats.straight5Flush).toEqual(0);
  });
});
