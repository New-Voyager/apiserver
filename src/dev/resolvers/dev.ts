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

const resolvers: any = {
  Mutation: {
    deleteGame: async (parent, args, ctx, info) => {
      return deleteGame(ctx.req.playerId, args.gameCode, args.includeGame);
    },
    debugHandLog: async (parent, args, ctx, info) => {
      return debugHandLog(ctx.req.playerId, args.gameCode, args.handNum);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
