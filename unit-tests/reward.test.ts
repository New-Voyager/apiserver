import {initializeSqlLite} from './utils';
import {createClub} from '../src/resolvers/club';
import {saveReward, getRewards} from '../src/resolvers/reward';
import {createPlayer} from '../src/resolvers/player';
import {getLogger} from '../src/utils/log';
const logger = getLogger('clubfreqmsg-unit-test');

beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

describe('Reward APIs', () => {
  test('create a reward', async () => {
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const rewardInput = {
      amount: 100.4,
      endHour: 4,
      minRank: 1,
      name: 'brady',
      startHour: 4,
      type: 'HIGH_HAND',
      schedule: 'HOURLY',
    };
    const resp = await saveReward(ownerId, clubCode, rewardInput);
    expect(resp).toStrictEqual(expect.any(Number));
    expect(resp).not.toBeNull();
  });

  test('get rewards', async () => {
    const rewardCount = 25;
    const ownerId = await createPlayer({
      player: {name: 'player1', deviceId: 'test', page: {count: 20}},
    });
    const clubInput = {
      name: 'bbc',
      description: 'poker players gather',
      ownerUuid: ownerId,
    };
    const clubCode = await createClub(ownerId, clubInput);
    const rewardInput = {
      amount: 100.4,
      endHour: 4,
      minRank: 1,
      name: 'brady',
      startHour: 4,
      type: 'HIGH_HAND',
      schedule: 'HOURLY',
    };
    for (let i = 0; i < rewardCount; i++) {
      await saveReward(ownerId, clubCode, rewardInput);
    }
    const resp = await getRewards(ownerId, clubCode);
    expect(resp).not.toBeNull();
    expect(resp).toHaveLength(25);
  });
});
