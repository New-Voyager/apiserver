import {Cache} from '@src/cache';
import {Player} from '@src/entity/player/player';
import { GameNotFoundError } from '@src/errors';
import {getLogger} from '@src/utils/log';

const logger = getLogger('resolvers::observers');

export async function observeGame(
  hostId: string,
  gameCode: string
): Promise<boolean> {
  const host = await Cache.getPlayer(hostId);
  if (!host) {
    throw new Error(`Player ${hostId} is not found`);
  }
  const game = await Cache.getGame(gameCode);
  if (!game) {
    throw new GameNotFoundError(gameCode);
  }
  if (game.clubCode) {
    const clubMember = await Cache.getClubMember(hostId, game.clubCode);
    if (!clubMember) {
      logger.error(
        `Player: ${hostId} is not a club member in club ${game.clubName}`
      );
      throw new Error(
        `Player: ${hostId} is not a club member in club ${game.clubName}`
      );
    }
  }
  return Cache.observeGame(gameCode, host);
}

export async function exitGame(
  hostId: string,
  gameCode: string
): Promise<boolean> {
  const host = await Cache.getPlayer(hostId);
  if (!host) {
    throw new Error(`Player ${hostId} is not found`);
  }
  const game = await Cache.getGame(gameCode);
  if (!game) {
    throw new GameNotFoundError(gameCode);
  }

  if (game.clubCode) {
    const clubMember = await Cache.getClubMember(hostId, game.clubCode);
    if (!clubMember) {
      logger.error(
        `Player: ${hostId} is not a club member in club ${game.clubName}`
      );
      throw new Error(
        `Player: ${hostId} is not a club member in club ${game.clubName}`
      );
    }
  }

  return Cache.removeGameObserver(gameCode, host);
}

export async function observers(
  hostId: string,
  gameCode: string
): Promise<Player[]> {
  const host = await Cache.getPlayer(hostId);
  if (!host) {
    throw new Error(`Player ${hostId} is not found`);
  }
  const game = await Cache.getGame(gameCode);
  if (!game) {
    throw new Error(`Game ${gameCode} is not found`);
  }
  if (game.clubCode) {
    const clubMember = await Cache.getClubMember(hostId, game.clubCode);
    if (!clubMember || !clubMember.isOwner) {
      logger.error(`Player: ${hostId} is not a host in club ${game.clubName}`);
      throw new Error(
        `Player: ${hostId} is not a host in club ${game.clubName}`
      );
    }
  } else {
    if (game.hostUuid !== hostId) {
      logger.error(`Player: ${hostId} is not a host in ${gameCode}`);
      throw new Error(`Player: ${hostId} is not a host in ${gameCode}`);
    }
  }

  return Cache.gameObservers(gameCode);
}

const resolvers: any = {
  Query: {
    observers: async (parent, args, ctx, info) => {
      return observers(ctx.req.playerId, args.gameCode);
    },
  },
  Mutation: {
    observeGame: async (parent, args, ctx, info) => {
      return observeGame(ctx.req.playerId, args.gameCode);
    },
    exitGame: async (parent, args, ctx, info) => {
      return exitGame(ctx.req.playerId, args.gameCode);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
