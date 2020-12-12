import * as _ from 'lodash';
import {RewardRepository} from '@src/repositories/reward';
import {getLogger} from '@src/utils/log';
import {RewardType, ScheduleType} from '@src/entity/types';
const logger = getLogger('clubfreqmessage');

export async function saveReward(
  playerId: string,
  clubCode: string,
  reward: any
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (!clubCode) {
    errors.push('Club object not found');
  }
  if (!reward) {
    errors.push('Reward Object not found');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    return RewardRepository.createReward(clubCode, reward);
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to create reward');
  }
}

export async function getRewards(playerId: string, clubCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const messages = await RewardRepository.getRewards(clubCode);
  return _.map(messages, x => {
    return {
      id: x.id,
      name: x.name,
      type: RewardType[x.type],
      amount: x.amount,
      minRank: x.minRank,
      startHour: x.startHour,
      endHour: x.endHour,
      schedule: ScheduleType[x.schedule],
    };
  });
}

const resolvers: any = {
  Mutation: {
    createReward: async (parent, args, ctx, info) => {
      return saveReward(ctx.req.playerId, args.clubCode, args.input);
    },
  },

  Query: {
    rewards: async (parent, args, ctx, info) => {
      return getRewards(ctx.req.playerId, args.clubCode);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
