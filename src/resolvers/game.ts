import {GameRepository} from '@src/repositories/game';
import {GameType} from '@src/entity/game';
import {getLogger} from '@src/utils/log';
const logger = getLogger('game');

export async function getGameById(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const game = await GameRepository.getGameById(gameCode);
  if (!game) {
    throw new Error('Game not found');
  }
  return {
    id: game.id,
  };
}

export async function startGame(playerId: string, clubCode: string, game: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const gameInfo = await GameRepository.createPrivateGame(
      clubCode,
      playerId,
      game
    );
    const ret: any = gameInfo as any;
    ret.gameType = GameType[gameInfo.gameType];
    return ret;
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to create a new game. ${JSON.stringify(err)}`);
  }
}

export async function startGameByPlayer(playerId: string, game: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const gameInfo = await GameRepository.createPrivateGameForPlayer(
      playerId,
      game
    );
    const ret: any = gameInfo as any;
    ret.gameType = GameType[gameInfo.gameType];
    return ret;
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to create a new game. ${JSON.stringify(err)}`);
  }
}

const resolvers: any = {
  Query: {
    gameById: async (parent, args, ctx, info) => {
      return getGameById(ctx.req.playerId, args.gameCode);
    },
  },
  Mutation: {
    startGame: async (parent, args, ctx, info) => {
      return startGame(ctx.req.playerId, args.clubCode, args.game);
    },
    startFriendsGame: async (parent, args, ctx, info) => {
      return startGameByPlayer(ctx.req.playerId, args.game);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
