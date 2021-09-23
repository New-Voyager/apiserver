import {resetDatabase, getClient, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getLogger} from '../../src/utils/log';
import {settlePlayerToPlayer} from './utils';
const logger = getLogger('club');

describe('SettlePlayerToPlayer APIs', () => {
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

  test('settlePlayerToPlayer', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    const playerId2 = await clubutils.createPlayer('adam2', '1243ABCs');
    await clubutils.playerJoinsClub(clubCode, playerId);
    await clubutils.playerJoinsClub(clubCode, playerId2);

    const data = await settlePlayerToPlayer({
      clubCode,
      ownerId,
      fromPlayerId: playerId,
      toPlayerId: playerId2,
      amount: 1,
      notes: 'test',
    });
    expect(data.settlePlayerToPlayer).toEqual(true);
  });
});
