import * as _ from 'lodash';
import {RewardRepository} from '@src/repositories/reward';
import {getLogger} from '@src/utils/log';
import {RewardType, ScheduleType} from '@src/entity/types';
import {centsToChips, chipsToCents} from '@src/utils';

const logger = getLogger('resolvers::reward');

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
    reward = rewardToServerUnits(reward);
    return RewardRepository.createReward(clubCode, reward);
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to create reward');
  }
}

function rewardToServerUnits(input: any): any {
  const r = {...input};
  r.amount = chipsToCents(r.amount);
  return r;
}

export async function getRewards(playerId: string, clubCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const messages = await RewardRepository.getRewards(clubCode);
  const rewards = _.map(messages, x => {
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
  return rewardsToClientUnits(rewards);
}

function rewardsToClientUnits(input: Array<any>): any {
  const resp = new Array<any>();
  for (const i of input) {
    const r = {...i};
    r.amount = centsToChips(r.amount);
    resp.push(r);
  }

  return resp;
}

export async function getHighHandsByGame(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const messages = await RewardRepository.highHandByGame(gameCode);
  return _.map(messages, x => {
    return {
      gameCode: x.gameCode,
      handNum: x.handNum,
      playerUuid: x.playerUuid,
      playerName: x.playerName,
      playerCards: x.playerCards,
      boardCards: x.boardCards,
      highHand: x.highHand,
      rank: x.rank,
      handTime: x.handTime,
      highHandCards: x.highHandCards,
      winner: x.winner,
    };
  });
}

export async function getHighHandsByReward(
  playerId: string,
  gameCode: string,
  rewardId: number
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const messages = await RewardRepository.highHandByReward(gameCode, rewardId);
  return _.map(messages, x => {
    return {
      gameCode: x.gameCode,
      handNum: x.handNum,
      playerUuid: x.playerUuid,
      playerName: x.playerName,
      playerCards: x.playerCards,
      boardCards: x.boardCards,
      highHand: x.highHand,
      rank: x.rank,
      handTime: x.handTime,
      highHandCards: x.highHandCards,
      winner: x.winner,
    };
  });
}

export async function getHighHandWinners(
  playerId: string,
  gameCode: string,
  rewardId: number
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const highHands = await RewardRepository.highHandByGame(gameCode);
  return _.map(highHands, x => {
    return {
      gameCode: x.gameCode,
      handNum: x.handNum,
      playerUuid: x.playerUuid,
      playerName: x.playerName,
      playerCards: x.playerCards,
      boardCards: x.boardCards,
      highHand: x.highHand,
      rank: x.rank,
      handTime: x.handTime,
      highHandCards: x.highHandCards,
      winner: x.winner,
    };
  });
}

export async function getRewardTrack(
  playerId: string,
  gameCode: string,
  rewardId: string
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const messages = await RewardRepository.getRewardTrack(gameCode, rewardId);
  return _.map(messages, x => {
    return {
      id: x.id,
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
    getRewardTrack: async (parent, args, ctx, info) => {
      return getRewardTrack(ctx.req.playerId, args.gameCode, args.rewardId);
    },
    highHandsByGame: async (parent, args, ctx, info) => {
      return getHighHandsByGame(ctx.req.playerId, args.gameCode);
    },
    highHandsByReward: async (parent, args, ctx, info) => {
      return getHighHandsByReward(
        ctx.req.playerId,
        args.gameCode,
        args.rewardId
      );
    },
    highHandWinners: async (parent, args, ctx, info) => {
      return getHighHandWinners(ctx.req.playerId, args.gameCode, args.rewardId);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
