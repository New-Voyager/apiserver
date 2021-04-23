import {GameRepository} from '@src/repositories/game';
import {PlayerRepository} from '@src/repositories/player';

async function deleteGame(
  playerId: string,
  gameCode: string,
  includeGame: boolean
) {
  return await GameRepository.deleteGame(playerId, gameCode, includeGame);
}

const resolvers: any = {
  Mutation: {
    deleteGame: async (parent, args, ctx, info) => {
      return deleteGame(ctx.req.playerId, args.gameCode, args.includeGame);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
