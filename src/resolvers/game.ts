import {GameRepository} from '@src/repositories/game';
import {GameType, PlayerStatus, BuyInApprovalStatus} from '@src/entity/types';
import {getLogger} from '@src/utils/log';
import {getGame, getPlayer, isClubMember} from '@src/cache/index';

const logger = getLogger('game');

export async function configureGame(
  playerId: string,
  clubCode: string,
  game: any
) {
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

export async function configureGameByPlayer(playerId: string, game: any) {
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

export async function joinGame(playerUuid: string, gameCode: string, seatNo: number) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await isClubMember(playerUuid, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode}`
        );
      }
    }

    const player = await getPlayer(playerUuid);
    const status = await GameRepository.joinGame(player, game, seatNo);
    // player is good to go
    return PlayerStatus[status];
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to create a new game. ${JSON.stringify(err)}`);
  }
}

export async function buyIn(playerUuid: string, gameCode: string, amount: number) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await isClubMember(playerUuid, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode}`
        );
      }
    }

    const player = await getPlayer(playerUuid);
    const status = await GameRepository.buyIn(
      player,
      game,
      amount,
      false /*reload*/
    );
    // player is good to go
    return BuyInApprovalStatus[status];
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to update buyin. ${JSON.stringify(err)}`);
  }
}

const resolvers: any = {
  Query: {
    gameById: async (parent, args, ctx, info) => {
      const game = await getGame(args.gameCode);
      return {
        id: game.id,
      };
    },
  },
  Mutation: {
    configureGame: async (parent, args, ctx, info) => {
      return configureGame(ctx.req.playerId, args.clubCode, args.game);
    },
    configureFriendsGame: async (parent, args, ctx, info) => {
      return configureGameByPlayer(ctx.req.playerId, args.game);
    },
    joinGame: async (parent, args, ctx, info) => {
      return joinGame(ctx.req.playerId, args.gameCode, args.seatNo);
    },
    buyIn: async (parent, args, ctx, info) => {
      return buyIn(ctx.req.playerId, args.gameCode, args.amount);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
