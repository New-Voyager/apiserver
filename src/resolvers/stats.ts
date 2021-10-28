import * as _ from 'lodash';
import {getLogger} from '@src/utils/log';
import {StatsRepository} from '@src/repositories/stats';
import {ClubMemberStatus, GameType} from '@src/entity/types';
import {Cache} from '@src/cache/index';
import {HistoryRepository} from '@src/repositories/history';
import {GameNotFoundError} from '@src/errors';

const logger = getLogger('resolvers::stats');

const resolvers: any = {
  Query: {
    clubStats: async (parent, args, ctx, info) => {
      return getClubStats(ctx.req.playerId, args.gameType, args.clubCode);
    },
    systemStats: async (parent, args, ctx, info) => {
      return getSystemStats(args.gameType);
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
  const clubMember = await Cache.getClubMember(playerId, clubCode);
  if (!clubMember || clubMember.status != ClubMemberStatus.ACTIVE) {
    throw new Error('The player is not in the club');
  }

  const gameType: GameType = GameType[gameTypeStr];
  const stats = await StatsRepository.getClubStats(gameType, clubCode);
  return stats;
}

async function getSystemStats(gameTypeStr: string) {
  const gameType: GameType = GameType[gameTypeStr];
  const stats = await StatsRepository.getSystemStats(gameType);
  return stats;
}

async function getPlayerHandStats(playerId: string) {
  const stats = await StatsRepository.getPlayerHandStats(playerId);
  try {
    stats.headsupHandSummary = JSON.parse(stats.headsupHandSummary);
  } catch (err) {}
  return stats;
}

async function getPlayerGameStats(playerId: string, gameCode: string) {
  const liveGame = await Cache.getGame(gameCode);
  let gameId = 0;
  if (liveGame) {
    gameId = liveGame.id;
  } else {
    const historyGame = await HistoryRepository.getHistoryGame(gameCode);
    if (!historyGame) {
      throw new GameNotFoundError(gameCode);
    }
    gameId = historyGame.gameId;
  }

  const stats = await StatsRepository.getPlayerGameStats(playerId, gameId);
  try {
    if (stats) {
      stats.headsupHandDetails = JSON.parse(stats.headsupHandDetails);
    }
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
