import {Cache} from '@src/cache/index';
import {PokerGame} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {PlayerStatus} from '@src/entity/types';
// import {openSeat} from '@src/gameserver';
import {GameRepository} from '@src/repositories/game';
import {PlayersInGameRepository} from '@src/repositories/playersingame';
import {
  hostSeatChangePlayers,
  SeatChangeProcess,
} from '@src/repositories/seatchange';
import {centsToChips} from '@src/utils';
import {errToStr, getLogger} from '@src/utils/log';
import {argsToArgsConfig} from 'graphql/type/definition';
import _ from 'lodash';
import {isHostOrManagerOrOwner} from './util';
const logger = getLogger('resolvers::seatchange');

const resolvers: any = {
  Query: {
    seatChangeRequests: async (parent, args, ctx, info) => {
      return await seatChangeRequests(ctx.req.playerId, args.gameCode);
    },
    seatPositions: async (parent, args, ctx, info) => {
      return await seatPositions(
        ctx.req.playerId,
        args.gameCode,
        args.seatChange
      );
    },
  },
  Mutation: {
    requestSeatChange: async (parent, args, ctx, info) => {
      return requestSeatChange(ctx.req.playerId, args.gameCode, args.cancel);
    },
    confirmSeatChange: async (parent, args, ctx, info) => {
      return confirmSeatChange(ctx.req.playerId, args.gameCode, args.seatNo);
    },
    declineSeatChange: async (parent, args, ctx, info) => {
      return declineSeatChange(ctx.req.playerId, args.gameCode);
    },
    beginHostSeatChange: async (parent, args, ctx, info) => {
      return beginHostSeatChange(ctx.req.playerId, args.gameCode);
    },
    seatChangeSwapSeats: async (parent, args, ctx, info) => {
      return swapSeats(
        ctx.req.playerId,
        args.gameCode,
        args.seatNo1,
        args.seatNo2
      );
    },
    seatChangeComplete: async (parent, args, ctx, info) => {
      return seatChangeComplete(
        ctx.req.playerId,
        args.gameCode,
        args.cancelChanges
      );
    },
    switchSeat: async (parent, args, ctx, info) => {
      return switchSeat(ctx.req.playerId, args.gameCode, args.seatNo);
    },
  },
};

export function getResolvers() {
  return resolvers;
}

export async function confirmSeatChange(
  playerUuid: string,
  gameCode: string,
  seatNo: number
) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.clubCode) {
      const clubMember = await Cache.getClubMember(playerUuid, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not a club member in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to make seat change ${gameCode}`
        );
      }
    }
    const player = await Cache.getPlayer(playerUuid);
    const seatChange = new SeatChangeProcess(game);
    const seatChangeStatus = await seatChange.confirmSeatChange(player, seatNo);
    return seatChangeStatus;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(
      `Failed to confirm seat change.  ${errToStr(err)} ${JSON.stringify(err)}`
    );
  }
}

export async function declineSeatChange(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.clubName) {
      const clubMember = await Cache.getClubMember(playerUuid, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not a club member in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to make seat change ${gameCode}`
        );
      }
    }
    const player = await Cache.getPlayer(playerUuid);
    const seatChange = new SeatChangeProcess(game);
    const seatChangeStatus = await seatChange.declineSeatChange(player);
    return seatChangeStatus;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to confirm seat change. ${JSON.stringify(err)}`);
  }
}

export async function requestSeatChange(
  playerUuid: string,
  gameCode: string,
  cancel: boolean
) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    if (!cancel) {
      cancel = false;
    }
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.clubCode) {
      const clubMember = await Cache.getClubMember(playerUuid, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
    }
    const player = await Cache.getPlayer(playerUuid);
    const seatChange = new SeatChangeProcess(game);
    const requestedAt = await seatChange.requestSeatChange(player, cancel);
    return requestedAt;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to request seat change. ${JSON.stringify(err)}`);
  }
}

export async function seatChangeRequests(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.clubCode) {
      const clubMember = await Cache.getClubMember(playerUuid, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
    }
    const player = await Cache.getPlayer(playerUuid);
    const seatChange = new SeatChangeProcess(game);
    const allPlayers = await seatChange.seatChangeRequests(player);

    const playerSeatChange = new Array<any>();
    allPlayers.map(player => {
      const data = {
        playerUuid: player.playerUuid,
        name: player.playerName,
        status: PlayerStatus[player.status],
        seatNo: player.seatNo,
        sessionTime: player.sessionTime,
        seatChangeRequestedAt: player.seatChangeRequestedAt,
      };
      playerSeatChange.push(data);
    });

    return playerSeatChange;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(
      `Failed to get seat change requests. ${JSON.stringify(err)}`
    );
  }
}

export async function seatPositions(
  playerUuid: string,
  gameCode: string,
  seatChange: boolean
) {
  let resp: Array<any>;
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.clubCode) {
      const clubMember = await Cache.getClubMember(playerUuid, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
    }
    if (seatChange) {
      // get seat positions from current seat change process
      const playersInSeats = await hostSeatChangePlayers(game.gameCode);
      for (const player of playersInSeats) {
        player.status = PlayerStatus[player.status];
        if (player.openSeat) {
          player.name = 'open';
          player.playerUuid = 'open';
        }
      }
      resp = playersInSeats;
    } else {
      // get seat positions from table
      const playersInTable = await PlayersInGameRepository.getPlayersInSeats(
        game.id
      );
      const players = new Array<any>();
      for (const playerInSeat of playersInTable) {
        const player = playerInSeat as any;
        player.openSeat = false;
        player.status = PlayerStatus[player.status];
        players.push(player);
      }
      const playersMap = _.keyBy(players, 'seatNo');
      const playersInSeats: Array<any> = [];
      for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
        if (!playersMap[seatNo]) {
          // open seat
          playersInSeats[seatNo - 1] = {
            name: 'open',
            playerUuid: 'open',
            seatNo: seatNo,
            openSeat: true,
          };
        } else {
          playersInSeats[seatNo - 1] = playersMap[seatNo];
        }
      }
      resp = playersInSeats;
    }
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(
      `Failed to get seat change requests. ${JSON.stringify(err)}`
    );
  }
  return seatPositionsToClientUnits(resp);
}

function seatPositionsToClientUnits(input: Array<any>): any {
  const resp = new Array<any>();
  for (const i of input) {
    const r = {...i};
    r.stack = centsToChips(r.stack);
    r.buyIn = centsToChips(r.buyIn);
    resp.push(r);
  }

  return resp;
}

export async function beginHostSeatChange(
  playerUuid: string,
  gameCode: string
): Promise<boolean> {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }
    // is the player host
    const isAuthorized = await isHostOrManagerOrOwner(playerUuid, game);
    if (!isAuthorized) {
      logger.error(
        `Player: ${playerUuid} is not a owner or a manager ${game.clubName}. Cannot make rearrange seats`
      );
      throw new Error(
        `Player: ${playerUuid} is not a owner or a manager ${game.clubName}. Cannot make rearrange seats`
      );
    }
    const host = await Cache.getPlayer(playerUuid);
    const seatChange = new SeatChangeProcess(game);
    await seatChange.beginHostSeatChange(host);
    return true;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(
      `Failed to start seat change process. ${JSON.stringify(err)}`
    );
  }
}

export async function swapSeats(
  playerUuid: string,
  gameCode: string,
  seatNo1: number,
  seatNo2: number
): Promise<boolean> {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }
    // is the player host
    const isAuthorized = await isHostOrManagerOrOwner(playerUuid, game);
    if (!isAuthorized) {
      logger.error(
        `Player: ${playerUuid} is not a owner or a manager ${game.clubName}. Cannot make rearrange seats`
      );
      throw new Error(
        `Player: ${playerUuid} is not a owner or a manager ${game.clubName}. Cannot make rearrange seats`
      );
    }
    const seatChange = new SeatChangeProcess(game);
    await seatChange.swapSeats(seatNo1, seatNo2);
    return true;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to swap seats. ${JSON.stringify(err)}`);
  }
}

export async function seatChangeComplete(
  playerUuid: string,
  gameCode: string,
  cancelChanges: boolean
) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }
    // is the player host
    const isAuthorized = await isHostOrManagerOrOwner(playerUuid, game);
    if (!isAuthorized) {
      logger.error(
        `Player: ${playerUuid} is not a owner or a manager ${game.clubName}. Cannot make rearrange seats`
      );
      throw new Error(
        `Player: ${playerUuid} is not a owner or a manager ${game.clubName}. Cannot make rearrange seats`
      );
    }
    const host = await Cache.getPlayer(playerUuid);
    const seatChange = new SeatChangeProcess(game);
    await seatChange.hostSeatChangeComplete(host, cancelChanges);
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(
      `Failed to complete seat change process. ${JSON.stringify(err)}`
    );
  }
}

export async function switchSeat(
  playerUuid: string,
  gameCode: string,
  seatNo: number
) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.clubCode) {
      const clubMember = await Cache.isClubMember(playerUuid, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode} in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode}`
        );
      }
    }

    const player = await Cache.getPlayer(playerUuid);
    const process = new SeatChangeProcess(game);
    const status = await process.switchSeat(player, seatNo);
    logger.debug(
      `Player: ${player.name} isBot: ${player.bot} switched seat game: ${game.gameCode}`
    );
    // player is good to go
    const playerStatus = PlayerStatus[status];
    return playerStatus;
  } catch (err) {
    logger.error(
      `Error while switching seat. playerUuid: ${playerUuid}, gameCode: ${gameCode}, seatNo: ${seatNo}: ${errToStr(
        err
      )}`
    );
    throw new Error(
      `Player: ${playerUuid} Failed to join the game. ${JSON.stringify(err)}`
    );
  }
}
