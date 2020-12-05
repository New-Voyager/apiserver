import {GameRepository} from '@src/repositories/game';
import {
  GameStatus,
  GameType,
  PlayerStatus,
  TableStatus,
  BuyInApprovalStatus,
} from '@src/entity/types';
import {getLogger} from '@src/utils/log';
import {
  getClubMember,
  getGame,
  getPlayer,
  isClubMember,
} from '@src/cache/index';
import {WaitListMgmt} from '@src/repositories/waitlist';

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
    ret.tableStatus = TableStatus[gameInfo.tableStatus];
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

export async function endGame(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const game = await getGame(gameCode);

    if (game.club) {
      // is the player club member
      const clubMember = await getClubMember(playerId, game.club.clubCode);
      if (!clubMember) {
        throw new Error('Player is not a club member');
      }

      // only manager and owner can end the game
      if (!(clubMember.isManager || clubMember.isOwner)) {
        throw new Error('Player is not a club owner or manager');
      }
    } else {
      // only club owner or host can end the game
      if (playerId !== game.startedBy.uuid) {
        throw new Error('Game can be ended up by the host');
      }
    }

    if (
      game.status === GameStatus.ACTIVE &&
      game.tableStatus === TableStatus.GAME_RUNNING
    ) {
      // the game will be stopped in the next hand
      GameRepository.endGameNextHand(game.id);
    } else {
      const status = await GameRepository.markGameEnded(game.id);
      return GameStatus[status];
    }
    return GameStatus[game.status];
  } catch (err) {
    logger.error(err.message);
    throw new Error('Failed to end the game. ' + err.message);
  }
}

export async function joinGame(
  playerUuid: string,
  gameCode: string,
  seatNo: number
) {
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
    throw new Error(
      `Player: ${playerUuid} Failed to join the game. ${JSON.stringify(err)}`
    );
  }
}

export async function startGame(
  playerUuid: string,
  gameCode: string
): Promise<string> {
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
      const clubMember = await getClubMember(playerUuid, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }

      if (!(clubMember.isManager || clubMember.isOwner)) {
        // this player cannot start this game
        logger.error(
          `Player: ${playerUuid} is not manager or owner. The player is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not manager or owner. The player is not authorized to start the game ${gameCode}`
        );
      }
    }

    const status = await GameRepository.markGameActive(game.id);
    // game is started
    return GameStatus[status];
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to start the game. ${JSON.stringify(err)}`);
  }
}

export async function buyIn(
  playerUuid: string,
  gameCode: string,
  amount: number
) {
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

export async function approveBuyIn(
  hostUuid: string,
  playerUuid: string,
  gameCode: string,
  amount: number
) {
  if (!hostUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await getClubMember(playerUuid, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }

      const clubHost = await getClubMember(hostUuid, game.club.clubCode);
      if (!clubHost || !(clubHost.isManager || clubHost.isOwner)) {
        logger.error(
          `Player: ${hostUuid} is not authorized to approve buyIn in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${hostUuid} is not authorized to approve buyIn in club ${game.club.name}`
        );
      }
    }

    const player = await getPlayer(playerUuid);
    const status = await GameRepository.approveBuyIn(player, game, amount);
    // player is good to go
    return BuyInApprovalStatus[status];
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to update buyin. ${JSON.stringify(err)}`);
  }
}

export async function myGameState(playerUuid: string, gameCode: string) {
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
      const clubMember = await getClubMember(playerUuid, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
    }

    const player = await getPlayer(playerUuid);
    const data = await GameRepository.myGameState(player, game);

    const gameState = {
      playerUuid: data.player.uuid,
      buyIn: data.buyIn,
      stack: data.stack,
      status: PlayerStatus[data.status],
      buyInStatus: BuyInApprovalStatus[data.status],
      playingFrom: data.satAt,
      waitlistNo: data.queueNo,
      seatNo: data.seatNo,
    };

    return gameState;
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to get game state. ${JSON.stringify(err)}`);
  }
}

export async function tableGameState(playerUuid: string, gameCode: string) {
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
      const clubMember = await getClubMember(playerUuid, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
    }

    const gameState = await GameRepository.tableGameState(game);

    const tableGameState = new Array<any>();
    gameState.map(data => {
      const gameState = {
        playerUuid: data.player.uuid,
        buyIn: data.buyIn,
        stack: data.stack,
        status: PlayerStatus[data.status],
        buyInStatus: BuyInApprovalStatus[data.status],
        playingFrom: data.satAt,
        waitlistNo: data.queueNo,
        seatNo: data.seatNo,
      };
      tableGameState.push(gameState);
    });

    return tableGameState;
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to get game state. ${JSON.stringify(err)}`);
  }
}

async function getGameInfo(playerUuid: string, gameCode: string) {
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

    const ret = game as any;
    if (ret.startedBy) {
      ret.startedBy = ret.startedBy.name;
    }
    ret.gameType = GameType[game.gameType];
    ret.tableStatus = TableStatus[game.tableStatus];
    ret.status = GameStatus[game.status];

    ret.gameToPlayerChannel = `game.${game.gameCode}.player`;
    ret.playerToHandChannel = `player.${game.gameCode}.hand`;
    ret.handToAllChannel = `hand.${game.gameCode}.player.all`;
    ret.handToPlayerChannel = `hand.${game.gameCode}.player.${player.id}`;

    return ret;
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to update buyin. ${JSON.stringify(err)}`);
  }
}

export async function leaveGame(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await GameRepository.getGameByCode(gameCode);

    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await getClubMember(playerUuid, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
    }
    const player = await getPlayer(playerUuid);
    const status = await GameRepository.leaveGame(player, game);
    return status;
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to leave game. ${JSON.stringify(err)}`);
  }
}

export async function takeBreak(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await GameRepository.getGameByCode(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await getClubMember(playerUuid, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
    }
    const player = await getPlayer(playerUuid);
    const status = await GameRepository.takeBreak(player, game);
    return status;
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to take break. ${JSON.stringify(err)}`);
  }
}

export async function requestSeatChange(playerUuid: string, gameCode: string) {
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
      const clubMember = await getClubMember(playerUuid, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
    }
    const player = await getPlayer(playerUuid);
    const requestedAt = await GameRepository.requestSeatChange(player, game);
    return requestedAt;
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to request seat change. ${JSON.stringify(err)}`);
  }
}

export async function seatChangeRequests(playerUuid: string, gameCode: string) {
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
      const clubMember = await getClubMember(playerUuid, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
    }
    const player = await getPlayer(playerUuid);
    const allPlayers = await GameRepository.seatChangeRequests(player, game);

    const playerSeatChange = new Array<any>();
    allPlayers.map(player => {
      const data = {
        playerUuid: player.player.uuid,
        name: player.player.name,
        status: PlayerStatus[player.status],
        seatNo: player.seatNo,
        sessionTime: player.sessionTime,
        seatChangeRequestedAt: player.seatChangeRequestedAt,
        seatChangeConfirmed: player.seatChangeConfirmed,
      };
      playerSeatChange.push(data);
    });

    return playerSeatChange;
  } catch (err) {
    logger.error(err);
    throw new Error(
      `Failed to get seat change requests. ${JSON.stringify(err)}`
    );
  }
}

export async function confirmSeatChange(playerUuid: string, gameCode: string) {
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
      const clubMember = await getClubMember(playerUuid, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not a club member in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to make seat change ${gameCode}`
        );
      }
    }
    const player = await getPlayer(playerUuid);
    const seatChangeStatus = await GameRepository.confirmSeatChange(
      player,
      game
    );
    return seatChangeStatus;
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to confirm seat change. ${JSON.stringify(err)}`);
  }
}

export async function kickOutPlayer(
  requestUser: string,
  gameCode: string,
  kickedOutPlayer: string
): Promise<boolean> {
  if (!requestUser) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      // club game
      const clubMember = await getClubMember(requestUser, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${requestUser} is not a club member in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${requestUser} is not authorized to kick out a user`
        );
      }

      if (!(clubMember.isOwner || clubMember.isManager)) {
        // player is not a owner or a manager
        // did this user start the game?
        if (game.startedBy.uuid !== requestUser) {
          logger.error(
            `Player: ${requestUser} cannot kick out a player in ${gameCode}`
          );
          throw new Error(
            `Player: ${requestUser} cannot kick out a player in ${gameCode}`
          );
        }
      }
    } else {
      // hosted by individual user
      if (game.startedBy.uuid !== requestUser) {
        logger.error(
          `Player: ${requestUser} cannot kick out a player in ${gameCode}`
        );
        throw new Error(
          `Player: ${requestUser} cannot kick out a player in ${gameCode}`
        );
      }
    }

    const player = await getPlayer(kickedOutPlayer);
    await GameRepository.kickOutPlayer(gameCode, player);
    return true;
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to kick out player');
  }
}

export async function addToWaitingList(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      // club game
      const clubMember = await getClubMember(playerId, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerId} is not a club member in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerId} is not authorized to kick out a user`
        );
      }
    }
    const waitlistMgmt = new WaitListMgmt(game);
    waitlistMgmt.addToWaitingList(playerId);
    return true;
  } catch (err) {
    logger.error(err);
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
    const game = await getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      // club game
      const clubMember = await getClubMember(playerId, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerId} is not a club member in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerId} is not authorized to kick out a user`
        );
      }
    }
    const waitlistMgmt = new WaitListMgmt(game);
    waitlistMgmt.removeFromWaitingList(playerId);
    return true;
  } catch (err) {
    logger.error(err);
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
    const game = await getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      // club game
      const clubMember = await getClubMember(playerId, game.club.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerId} is not a club member in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerId} is not authorized to kick out a user`
        );
      }
    }
    const waitlistMgmt = new WaitListMgmt(game);
    return waitlistMgmt.getWaitingListUsers();
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to kick out player');
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
    myGameState: async (parent, args, ctx, info) => {
      return myGameState(ctx.req.playerId, args.gameCode);
    },
    tableGameState: async (parent, args, ctx, info) => {
      return tableGameState(ctx.req.playerId, args.gameCode);
    },
    gameInfo: async (parent, args, ctx, info) => {
      return await getGameInfo(ctx.req.playerId, args.gameCode);
    },
    seatChangeRequests: async (parent, args, ctx, info) => {
      return await seatChangeRequests(ctx.req.playerId, args.gameCode);
    },
    waitingList: async (parent, args, ctx, info) => {
      return await waitingList(ctx.req.playerId, args.gameCode);
    },
  },
  GameInfo: {
    seatInfo: async (parent, args, ctx, info) => {
      const game = await getGame(parent.gameCode);
      const playersInSeats = await GameRepository.getPlayersInSeats(game.id);
      const takenSeats = playersInSeats.map(x => x.seatNo);
      const availableSeats: Array<number> = [];
      for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
        if (takenSeats.indexOf(seatNo) === -1) {
          availableSeats.push(seatNo);
        }
      }
      return {
        playersInSeats: playersInSeats,
        availableSeats: availableSeats,
      };
    },
    gameToken: async (parent, args, ctx, info) => {
      const game = await getGame(parent.gameCode);
      let playerState = ctx['playerState'];
      if (!playerState) {
        // get player's game state
        playerState = await GameRepository.getGamePlayerState(
          game.id,
          ctx.req.playerId
        );
        ctx['playerState'] = playerState;
      }
      if (playerState) {
        return playerState.gameToken;
      }
      return null;
    },
    playerGameStatus: async (parent, args, ctx, info) => {
      const game = await getGame(parent.gameCode);
      let playerState = ctx['playerState'];
      if (!playerState) {
        // get player's game state
        playerState = await GameRepository.getGamePlayerState(
          game.id,
          ctx.req.playerId
        );
        ctx['playerState'] = playerState;
      }
      if (playerState) {
        return PlayerStatus[playerState.playerStatus];
      }
      return PlayerStatus[PlayerStatus.NOT_PLAYING];
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
    endGame: async (parent, args, ctx, info) => {
      return endGame(ctx.req.playerId, args.gameCode);
    },
    buyIn: async (parent, args, ctx, info) => {
      return buyIn(ctx.req.playerId, args.gameCode, args.amount);
    },
    approveBuyIn: async (parent, args, ctx, info) => {
      return approveBuyIn(
        ctx.req.playerId,
        args.playerUuid,
        args.gameCode,
        args.amount
      );
    },
    startGame: async (parent, args, ctx, info) => {
      return startGame(ctx.req.playerId, args.gameCode);
    },
    takeBreak: async (parent, args, ctx, info) => {
      return takeBreak(ctx.req.playerId, args.gameCode);
    },
    leaveGame: async (parent, args, ctx, info) => {
      return leaveGame(ctx.req.playerId, args.gameCode);
    },
    requestSeatChange: async (parent, args, ctx, info) => {
      return requestSeatChange(ctx.req.playerId, args.gameCode);
    },
    confirmSeatChange: async (parent, args, ctx, info) => {
      return confirmSeatChange(ctx.req.playerId, args.gameCode);
    },
    kickOut: async (parent, args, ctx, info) => {
      return kickOutPlayer(ctx.req.playerId, args.gameCode, args.playerUuid);
    },
    addToWaitingList: async (parent, args, ctx, info) => {
      return addToWaitingList(ctx.req.playerId, args.gameCode);
    },
    removeFromWaitingList: async (parent, args, ctx, info) => {
      return removeFromWaitingList(ctx.req.playerId, args.gameCode);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
