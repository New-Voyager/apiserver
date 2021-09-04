import * as _ from 'lodash';
import {getLogger} from '@src/utils/log';
import {StatsRepository} from '@src/repositories/stats';
import {GameType} from '@src/entity/types';
import {Cache} from '@src/cache/index';

const logger = getLogger('resolvers::stats');

const resolvers: any = {
  Query: {
    clubStats: async (parent, args, ctx, info) => {
      return getClubStats(ctx.req.playerId, args.gameType, args.clubCode);
    },
    systemStats: async (parent, args, ctx, info) => {
      return getSystemStats();
    },
    playerHandStats: async (parent, args, ctx, info) => {
      return getPlayerHandStats(ctx.req.playerId);
    },
    playerGameStats: async (parent, args, ctx, info) => {
      return getPlayerGameStats(ctx.req.playerId, args.gameCode);
    },
    playerRecentPerformance: async (parent, args, ctx, info) => {
      return getPlayerRecentPerformance(ctx.req.playerId);
    },
  },
};

async function getClubStats(
  playerId: string,
  gameTypeStr: string,
  clubCode: string
) {
  const gameType: GameType = GameType[gameTypeStr];
  const stats = await StatsRepository.getClubStats(gameType, clubCode);
  return stats;
}

async function getSystemStats() {
  return null;
}

async function getPlayerHandStats(playerId: string) {
  const stats = await StatsRepository.getPlayerHandStats(playerId);
  try {
    stats.headsupHandSummary = JSON.parse(stats.headsupHandSummary);
  } catch (err) {}
  return stats;
}

async function getPlayerGameStats(playerId: string, gameCode: string) {
  const stats = await StatsRepository.getPlayerGameStats(playerId, gameCode);
  try {
    stats.headsupHandDetails = JSON.parse(stats.headsupHandDetails);
  } catch (err) {}
  return stats;
}

async function getPlayerRecentPerformance(playerId: string) {
  try {
    const player = await Cache.getPlayer(playerId);
    const recentPerformance = await StatsRepository.getPlayerRecentPerformance(
      player
    );
    return JSON.parse(recentPerformance);
  } catch (err) {}
  return [];
}

export function getResolvers() {
  return resolvers;
}
