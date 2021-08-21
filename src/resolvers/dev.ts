import {GameRepository} from '@src/repositories/game';
import {Cache} from '@src/cache/index';
import {DevRepository} from '@src/repositories/dev';

async function deleteGame(
  playerId: string,
  gameCode: string,
  includeGame: boolean
) {
  return await GameRepository.deleteGame(playerId, gameCode, includeGame);
}

async function debugHandLog(
  playerId: string,
  gameCode: string,
  handNum: number
) {
  const player = await Cache.getPlayer(playerId);
  return await DevRepository.debugHandLog(player, gameCode, handNum);
}

async function reportBug(playerId: string, bug: string) {
  const player = await Cache.getPlayer(playerId);
  return await DevRepository.reportBug(player, bug);
}

async function requestFeature(playerId: string, bug: string) {
  const player = await Cache.getPlayer(playerId);
  return await DevRepository.requestFeature(player, bug);
}

const resolvers: any = {
  Mutation: {
    deleteGame: async (parent, args, ctx, info) => {
      return deleteGame(ctx.req.playerId, args.gameCode, args.includeGame);
    },
    debugHandLog: async (parent, args, ctx, info) => {
      return debugHandLog(ctx.req.playerId, args.gameCode, args.handNum);
    },
    reportBug: async (parent, args, ctx, info) => {
      return reportBug(ctx.req.playerId, args.bug);
    },
    requestFeature: async (parent, args, ctx, info) => {
      return requestFeature(ctx.req.playerId, args.feature);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
