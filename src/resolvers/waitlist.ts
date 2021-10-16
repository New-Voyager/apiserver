import {getLogger, errToLogString} from '@src/utils/log';
import {Cache} from '@src/cache/index';
import {WaitListMgmt} from '@src/repositories/waitlist';
import {default as _} from 'lodash';
const logger = getLogger('resolvers::waitlist');

const resolvers: any = {
  Query: {
    waitingList: async (parent, args, ctx, info) => {
      return await waitingList(ctx.req.playerId, args.gameCode);
    },
  },
  Mutation: {
    addToWaitingList: async (parent, args, ctx, info) => {
      return addToWaitingList(ctx.req.playerId, args.gameCode);
    },
    removeFromWaitingList: async (parent, args, ctx, info) => {
      return removeFromWaitingList(ctx.req.playerId, args.gameCode);
    },
    applyWaitlistOrder: async (parent, args, ctx, info) => {
      return applyWaitlistOrder(
        ctx.req.playerId,
        args.gameCode,
        args.playerUuid
      );
    },
    declineWaitlistSeat: async (parent, args, ctx, info) => {
      return declineWaitlistSeat(ctx.req.playerId, args.gameCode);
    },
  },
};

export async function addToWaitingList(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.clubCode) {
      // club game
      const clubMember = await Cache.getClubMember(playerId, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerId} is not a club member in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerId} is not authorized to update waiting list for club ${game.clubName} (addToWaitingList)`
        );
      }
    }
    const waitlistMgmt = new WaitListMgmt(game);
    await waitlistMgmt.addToWaitingList(playerId);
    return true;
  } catch (err) {
    logger.error(
      `Error while adding to waiting list. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error('Failed to add player to waiting list');
  }
}

export async function removeFromWaitingList(
  playerId: string,
  gameCode: string
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.clubCode) {
      // club game
      const clubMember = await Cache.getClubMember(playerId, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerId} is not a club member in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerId} is not authorized to update waiting list for club ${game.clubName} (removeFromWaitingList)`
        );
      }
    }
    const waitlistMgmt = new WaitListMgmt(game);
    await waitlistMgmt.removeFromWaitingList(playerId);
    return true;
  } catch (err) {
    logger.error(
      `Error while removing from waiting list. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error('Failed to remove player from waiting list');
  }
}

export async function waitingList(
  playerId: string,
  gameCode: string
): Promise<Array<any>> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.clubCode) {
      // club game
      const clubMember = await Cache.getClubMember(playerId, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerId} is not a club member in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerId} is not authorized to get waiting list for club ${game.clubName}`
        );
      }
    }
    const waitlistMgmt = new WaitListMgmt(game);
    return waitlistMgmt.getWaitingListUsers();
  } catch (err) {
    logger.error(
      `Error while getting waiting list. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error('Failed to kick out player');
  }
}

export async function applyWaitlistOrder(
  hostUuid: string,
  gameCode: string,
  players: Array<string>
): Promise<boolean> {
  if (!hostUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.clubCode) {
      // club game
      const clubMember = await Cache.getClubMember(hostUuid, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${hostUuid} is not a club member in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${hostUuid} is not authorized to change waitlist order`
        );
      }

      if (!(clubMember.isOwner || clubMember.isManager)) {
        // player is not a owner or a manager
        // did this user start the game?
        if (game.hostUuid !== hostUuid) {
          logger.error(
            `Player: ${hostUuid} cannot change waitlist order in ${gameCode}`
          );
          throw new Error(
            `Player: ${hostUuid} cannot change waitlist order in ${gameCode}`
          );
        }
      }
    } else {
      // hosted by individual user
      if (game.hostUuid !== hostUuid) {
        logger.error(
          `Player: ${hostUuid} cannot change waitlist order in ${gameCode}`
        );
        throw new Error(
          `Player: ${hostUuid} cannot change waitlist order in ${gameCode}`
        );
      }
    }

    const waitlistMgmt = new WaitListMgmt(game);
    await waitlistMgmt.applyWaitlistOrder(players);
    return true;
  } catch (err) {
    logger.error(
      `Error while applying waitlist order. hostUuid: ${hostUuid}, gameCode: ${gameCode}, players: ${JSON.stringify(
        players
      )}: ${errToLogString(err)}`
    );
    throw new Error('Failed to change waitlist order');
  }
}

export async function declineWaitlistSeat(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.clubCode) {
      // club game
      const clubMember = await Cache.getClubMember(playerId, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerId} is not a club member in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerId} is not authorized to update waitlist seat for club ${game.clubName} (declineWaitlistSeat)`
        );
      }
    }
    const waitlistMgmt = new WaitListMgmt(game);
    const player = await Cache.getPlayer(playerId);
    await waitlistMgmt.declineWaitlistSeat(player);
    return true;
  } catch (err) {
    logger.error(
      `Error while declining waitlist seat. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error('Failed to add player to waiting list');
  }
}

export function getResolvers() {
  return resolvers;
}
