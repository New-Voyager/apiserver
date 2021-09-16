import * as clubutils from './utils/club.testutils';
import * as rewardutils from './utils/reward.testutils';
import {resetDatabase, getClient} from './utils/utils';
import {getLogger} from '../src/utils/log';
const logger = getLogger('reward');

beforeAll(async done => {
  await resetDatabase();
  done();
});

afterAll(async done => {
  done();
});

describe('Reward APIs', () => {
  test('Create a reward', async () => {
    const [clubCode] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');

    let resp;
    const rewardInput = {
      amount: 100,
      endHour: 4,
      minRank: 1,
      name: 'brady',
      startHour: 4,
      type: 'HIGH_HAND',
      schedule: 'HOURLY',
    };
    const response = await getClient(playerId).mutate({
      variables: {
        clubCode: clubCode,
        input: rewardInput,
      },
      mutation: rewardutils.createReward,
    });
    expect(response.errors).toBeUndefined();
    expect(response.data).not.toBeUndefined();
    const rewardId = response.data.id;
    expect(rewardId).not.toBeNull();
  });

  test('get rewards', async () => {
    const [clubCode] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');

    const rewardCount = 25;
    const rewardInput = {
      amount: 100,
      endHour: 4,
      minRank: 1,
      name: 'brady',
      startHour: 4,
      type: 'HIGH_HAND',
      schedule: 'HOURLY',
    };
    for (let i = 0; i < rewardCount; i++) {
      await getClient(playerId).mutate({
        variables: {
          clubCode: clubCode,
          input: rewardInput,
        },
        mutation: rewardutils.createReward,
      });
    }
    const result = await rewardutils.getRewards(playerId, clubCode);
    expect(result).toHaveLength(25);
  });
});
