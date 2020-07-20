import {GameRepository} from '@src/repositories/game';
import {GameType} from '@src/entity/game';
import {getLogger} from '@src/utils/log';
const logger = getLogger('game');

export async function getGameById(playerId: string, gameId: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const game = await GameRepository.getGameById(gameId);
  if (!game) {
    throw new Error('Game not found');
  }
  return {
    id: game.id,
  };
}

export async function startGame(playerId: string, clubId: string, game: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const gameInfo = await GameRepository.createPrivateGame(
      clubId,
      playerId,
      game
    );
    const ret: any = gameInfo as any;
    ret.gameType = GameType[gameInfo.gameType];
    logger.debug(JSON.stringify(ret));
    return ret;
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to create a new game. ${JSON.stringify(err)}`);
  }
}

const resolvers: any = {
  Query: {
    gameById: async (parent, args, ctx, info) => {
      return getGameById(ctx.req.playerId, args.gameId);
    },
  },
  Mutation: {
    startGame: async (parent, args, ctx, info) => {
      return startGame(ctx.req.playerId, args.clubId, args.game);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
