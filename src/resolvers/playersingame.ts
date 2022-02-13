import {GameRepository} from '@src/repositories/game';
import {BuyInApprovalLimit, GameType, PlayerStatus} from '@src/entity/types';
import {getLogger, errToStr} from '@src/utils/log';
import {Cache} from '@src/cache/index';
import {default as _} from 'lodash';
import {BuyIn} from '@src/repositories/buyin';
import {ApolloError} from 'apollo-server-express';
import {BuyInResponse, SitBackResponse} from '@src/repositories/types';
import {TakeBreak} from '@src/repositories/takebreak';
import {Player} from '@src/entity/player/player';
import {Reload} from '@src/repositories/reload';
import {PlayersInGameRepository} from '@src/repositories/playersingame';
import {NextHandUpdatesRepository} from '@src/repositories/nexthand_update';
import {
  Errors,
  GameNotFoundError,
  GenericError,
  UnauthorizedError,
} from '@src/errors';
import {gameLogPrefix} from '@src/entity/game/game';
import {HistoryRepository} from '@src/repositories/history';
import {centsToChips, chipsToCents} from '@src/utils';
import {LocationCheck} from '@src/repositories/locationcheck';
import {PlayerRepository} from '@src/repositories/player';

const logger = getLogger('resolvers::players_in_game');

const resolvers: any = {
  Query: {
    gamePlayers: async (parent, args, ctx, info) => {
      return await getGamePlayers(args.gameCode);
    },
    playerStackStat: async (parent, args, ctx, info) => {
      return playerStackStat(ctx.req.playerId, args.gameCode);
    },
    playersInGameById: async (parent, args, ctx, info) => {
      return await playersInGameById(ctx.req.playerId, args.gameCode);
    },
    playersGameTrackerById: async (parent, args, ctx, info) => {
      return await playersGameTrackerById(ctx.req.playerId, args.gameCode);
    },
  },
  Mutation: {
    joinGame: async (parent, args, ctx, info) => {
      let ip = '';
      const gameSettings = await Cache.getGameSettings(args.gameCode);
      if (gameSettings !== null) {
        if (gameSettings.ipCheck) {
          ip = ctx.req.userIp;
        }
      }

      return joinGame(ctx.req.playerId, args.gameCode, args.seatNo, {
        ip: ip,
        location: args.location,
      });
    },
    takeSeat: async (parent, args, ctx, info) => {
      return takeSeat(ctx.req.playerId, args.gameCode, args.seatNo, {
        ip: ctx.req.userIp,
        location: args.location,
      });
    },
    buyIn: async (parent, args, ctx, info) => {
      const status = await buyIn(ctx.req.playerId, args.gameCode, args.amount);
      return status;
    },
    reload: async (parent, args, ctx, info) => {
      const ret = reload(ctx.req.playerId, args.gameCode, args.amount);
      return ret;
    },
    takeBreak: async (parent, args, ctx, info) => {
      return takeBreak(ctx.req.playerId, args.gameCode);
    },
    sitBack: async (parent, args, ctx, info) => {
      let ip = '';
      const gameSettings = await Cache.getGameSettings(args.gameCode);
      if (gameSettings !== null) {
        if (gameSettings.ipCheck) {
          ip = ctx.req.userIp;
        }
      }

      const ret = await sitBack(ctx.req.playerId, args.gameCode, {
        ip: ip,
        location: args.location,
      });
      return ret;
    },
    leaveGame: async (parent, args, ctx, info) => {
      return leaveGame(ctx.req.playerId, args.gameCode);
    },
    kickOut: async (parent, args, ctx, info) => {
      return kickOutPlayer(ctx.req.playerId, args.gameCode, args.playerUuid);
    },
    sitOut: async (parent, args, ctx, info) => {
      return sitOutPlayer(ctx.req.playerId, args.gameCode, args.playerUuid);
    },
    setBuyInLimit: async (parent, args, ctx, info) => {
      return setBuyInLimit(
        ctx.req.playerId,
        args.gameCode,
        args.playerUuid,
        args.playerId,
        args.limit
      );
    },
    dealerChoice: async (parent, args, ctx, info) => {
      return dealerChoice(
        ctx.req.playerId,
        args.gameCode,
        args.gameType,
        args.doubleBoard
      );
    },
    postBlind: async (parent, args, ctx, info) => {
      return postBlind(ctx.req.playerId, args.gameCode);
    },
    autoReload: async (parent, args, ctx, info) => {
      return autoReload(
        ctx.req.playerId,
        args.gameCode,
        args.reloadThreshold,
        args.reloadTo
      );
    },
    autoReloadOff: async (parent, args, ctx, info) => {
      return autoReloadOff(ctx.req.playerId, args.gameCode);
    },
  },
};

export async function getGamePlayers(gameCode: string) {
  try {
    const game = await Cache.getGame(gameCode);
    if (!game) {
      // check in history table
      const historyGame = await HistoryRepository.getHistoryGame(gameCode);
      if (!historyGame) {
        throw new GameNotFoundError(gameCode);
      }
      return await HistoryRepository.getGamePlayers(historyGame);
    } else {
      const resp = await GameRepository.getGamePlayers(gameCode);
      return resp;
    }
  } catch (err) {
    logger.error(
      `Error while getting game players. gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new Error(
      `Failed to get game players information. ${JSON.stringify(err)}`
    );
  }
}

export async function playerStackStat(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new UnauthorizedError();
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const player = await Cache.getPlayer(playerId);
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }

    const stackStat = await GameRepository.getPlayerStackStat(player, game);

    /*
    type GameStackStat {
        handNum: Int
        before: Float
        after: Float
      }
      */
    return stackStat;
  } catch (err) {
    logger.error(
      `Error while getting player stack stat. playerId: ${playerId}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new Error(
      `Failed to resume game:  ${errToStr(err)}. Game code: ${gameCode}`
    );
  }
}

export async function playersInGameById(playerId: string, gameCode: string) {
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
      const clubMember = await Cache.getClubMember(playerId, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerId} is not authorized to start the game ${gameCode} in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerId} is not authorized to start the game ${gameCode}`
        );
      }
    }

    const playersInGame = await PlayersInGameRepository.getPlayersInGameById(
      game.id
    );
    if (!playersInGame) {
      logger.error(
        `playersInGame not found for the game ${gameCode} in club ${game.clubName}`
      );
      throw new Error(
        `playersInGame not found for the game ${gameCode} in club ${game.clubName}`
      );
    }
    const playersInGameData = new Array<any>();
    playersInGame.map(data => {
      const playerInGame = {
        buyIn: data.buyIn,
        handStack: data.handStack,
        leftAt: data.leftAt,
        noHandsPlayed: data.noHandsPlayed,
        noHandsWon: data.noHandsWon,
        noOfBuyins: data.noOfBuyins,
        playerId: data.playerId,
        playerName: data.playerName,
        playerUuid: data.playerUuid,
        sessionTime: data.sessionTime,
      };
      playersInGameData.push(playerInGame);
    });
    return playersInGameData;
  } catch (err) {
    logger.error(
      `Error while getting players in game data. playerId: ${playerId}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new Error(`Failed to retreive players in game data - ${err}`);
  }
}

export async function playersGameTrackerById(
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
      const clubMember = await Cache.getClubMember(playerId, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerId} is not authorized to start the game ${gameCode} in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerId} is not authorized to start the game ${gameCode}`
        );
      }
    }

    const playersGameTracker =
      await PlayersInGameRepository.getPlayersGameTrackerById(game.id);
    if (!playersGameTracker) {
      logger.error(
        `Player Game Tracker not found for the game ${gameCode} in club ${game.clubName}`
      );
      throw new Error(
        `Player Game Tracker not found for the game ${gameCode} in club ${game.clubName}`
      );
    }
    const playerGameTrackerData = new Array<any>();
    playersGameTracker.map(data => {
      const playerGameTracker = {
        buyIn: data.buyIn,
        handStack: data.handStack,
        leftAt: data.leftAt,
        noHandsPlayed: data.noHandsPlayed,
        noHandsWon: data.noHandsWon,
        noOfBuyins: data.noOfBuyins,
        playerId: data.playerId,
        playerName: data.playerName,
        playerUuid: data.playerUuid,
        sessionTime: data.sessionTime,
      };
      playerGameTrackerData.push(playerGameTracker);
    });
    return playerGameTrackerData;
  } catch (err) {
    logger.error(
      `Error while getting players game tracker data. playerId: ${playerId}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new Error(`Failed to retreive players in game data - ${err}`);
  }
}

export async function joinGame(
  playerUuid: string,
  gameCode: string,
  seatNo: number,
  locationCheck?: {
    location: any;
    ip: string;
  }
) {
  if (!playerUuid) {
    throw new UnauthorizedError();
  }
  let playerName = playerUuid;
  const startTime = new Date().getTime();
  try {
    let player: Player | null = await Cache.getPlayer(playerUuid);
    playerName = player.name;

    logger.debug(`Player ${playerName} is joining game ${gameCode}`);
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
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
    let ip = '';
    let location: any = {};
    if (locationCheck) {
      ip = locationCheck.ip;
      location = locationCheck.location;
    }
    logger.info(
      `${gameLogPrefix(game)} Player: ${player.uuid}/${
        player.name
      } is joining seat ${seatNo}. Ip: ${ip} location: ${JSON.stringify(
        location
      )}`
    );

    player = await Cache.updatePlayerLocation(player.uuid, location, ip);
    if (!player) {
      throw new Error(`Player ${playerUuid} is not found`);
    }
    const status = await GameRepository.joinGame(
      player,
      game,
      seatNo,
      ip,
      location
    );
    logger.debug(
      `Player: ${player.name} isBot: ${player.bot} joined game: ${game.gameCode}`
    );

    const playerInGame = await PlayersInGameRepository.getPlayerInfo(
      game,
      player
    );
    let resp: any = {};
    if (playerInGame) {
      resp.missedBlind = playerInGame.missedBlind;
      resp.status = PlayerStatus[playerInGame.status];
      return resp;
    }
    return {
      missedBlind: false,
      status: PlayerStatus[PlayerStatus.NOT_PLAYING],
    };
  } catch (err) {
    logger.error(
      `Error while joining game. playerUuid: ${playerUuid}, gameCode: ${gameCode}, seatNo: ${seatNo}, locationCheck: ${JSON.stringify(
        locationCheck
      )}: ${errToStr(err)}`
    );
    if (err instanceof ApolloError) {
      throw err;
    } else {
      throw new GenericError(
        Errors.JOIN_FAILED,
        `Player: ${playerName} Failed to join the game ${gameCode}. ${JSON.stringify(
          err
        )}`
      );
    }
  } finally {
    const timeTaken = new Date().getTime() - startTime;
    logger.debug(`joinGame took ${timeTaken} ms`);
  }
}

export async function takeSeat(
  playerUuid: string,
  gameCode: string,
  seatNo: number,
  locationCheck?: {
    ip: string;
    location: any;
  }
) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  let playerName = playerUuid;
  const startTime = new Date().getTime();
  try {
    const player = await Cache.getPlayer(playerUuid);
    playerName = player.name;

    logger.debug(`Player ${playerName} is joining game ${gameCode}`);
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
    let ip = '';
    let location: any = null;
    if (locationCheck) {
      ip = locationCheck.ip;
      location = locationCheck.location;
      logger.info(
        `[${gameLogPrefix(game)}] Player IP: Player: [${player.name}] IP: ${ip}`
      );
      const geodata = LocationCheck.getCity(ip);
      if (geodata) {
        await PlayerRepository.updatePlayerGeoData(
          player.uuid,
          geodata.continent,
          geodata.country,
          geodata.state,
          geodata.city,
          geodata.postalCode
        );
      }
      await Cache.updatePlayerLocation(player.uuid, location, ip);
    }
    logger.info(
      `[${gameLogPrefix(game)}] Player: ${player.uuid}/${
        player.name
      } is taking seat ${seatNo}. Ip: ${ip} location: ${JSON.stringify(
        location
      )}`
    );

    const status = await GameRepository.joinGame(
      player,
      game,
      seatNo,
      ip,
      location
    );
    logger.info(
      `${gameLogPrefix(game)} Player: ${player.uuid}/${player.name} isBot: ${
        player.bot
      } has taken seat ${seatNo}. Ip: ${ip} location: ${JSON.stringify(
        location
      )}`
    );

    const playerInSeat = await PlayersInGameRepository.getSeatInfo(
      game.id,
      seatNo
    );

    if (!playerInSeat.audioToken) {
      playerInSeat.agoraToken = playerInSeat.audioToken;
    }

    playerInSeat.status = PlayerStatus[playerInSeat.status];
    playerInSeat.name = playerInSeat.playerName;
    playerInSeat.buyInExpTime = playerInSeat.buyInExpAt;
    playerInSeat.breakExpTime = playerInSeat.breakTimeExpAt;
    playerInSeat.stack = centsToChips(playerInSeat.stack);
    return playerInSeat;
  } catch (err) {
    logger.error(
      `Error while taking seat. playerUuid: ${playerUuid}, gameCode: ${gameCode}, seatNo: ${seatNo}, locationCheck: ${JSON.stringify(
        locationCheck
      )}: ${errToStr(err)}`
    );
    if (err instanceof ApolloError) {
      throw err;
    } else {
      throw new GenericError(
        Errors.JOIN_FAILED,
        `Player: ${playerName} Failed to join the game. ${JSON.stringify(err)}`
      );
    }
  } finally {
    const timeTaken = new Date().getTime() - startTime;
    logger.debug(`joinGame took ${timeTaken} ms`);
  }
}

export async function buyIn(
  playerUuid: string,
  gameCode: string,
  chips: number
) {
  if (!playerUuid) {
    throw new UnauthorizedError();
  }
  const startTime = new Date().getTime();
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
    logger.info(
      `${gameLogPrefix(game)} Player: ${player.uuid}/${
        player.name
      } is buying for ${chips}`
    );

    const buyin = new BuyIn(game, player);
    const cents = chipsToCents(chips);
    const status = await buyin.request(cents);

    const timeTaken = new Date().getTime() - startTime;
    logger.info(`Buyin took ${timeTaken}ms`);

    /*
    type BuyInResponse {
      missedBlind: Boolean
      status: PlayerGameStatus
      approved: Boolean!
      expireSeconds: Int
    }*/
    const playerInGame = await PlayersInGameRepository.getPlayerInfo(
      game,
      player
    );
    let resp: any = {};
    if (playerInGame) {
      resp.missedBlind = playerInGame.missedBlind;
      resp.status = PlayerStatus[playerInGame.status];
      resp.approved = status.approved;
      resp.expireSeconds = status.expireSeconds;
      if (status.availableCredits) {
        resp.availableCredits = centsToChips(status.availableCredits);
      }
      resp.insufficientCredits = status.insufficientCredits;
      return resp;
    }
    return {
      missedBlind: false,
      status: PlayerStatus[PlayerStatus.NOT_PLAYING],
      approved: false,
      expireSeconds: status.expireSeconds,
      availableCredits: status.availableCredits
        ? centsToChips(status.availableCredits)
        : undefined,
      insuffcientCredits: status.insufficientCredits,
    };
  } catch (err) {
    const timeTaken = new Date().getTime() - startTime;
    logger.error(
      `Error while buying in. playerUuid: ${playerUuid}, gameCode: ${gameCode}, amount: ${chips}: ${errToStr(
        err
      )}`
    );
    throw new GenericError(Errors.BUYIN_FAILED, `Failed to buyin`);
  }
}

export async function reload(
  playerUuid: string,
  gameCode: string,
  chips: number
): Promise<any> {
  if (!playerUuid) {
    throw new UnauthorizedError();
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
    logger.info(
      `${gameLogPrefix(game)} Player: ${player.uuid}/${
        player.name
      } is reloading for ${chips}`
    );

    const reload = new Reload(game, player);
    const cents = chipsToCents(chips);
    const ret = (await reload.request(cents)) as any;
    if (ret.availableCredits) {
      ret.availableCredits = centsToChips(ret.availableCredits);
    }
    if (ret.status) {
      ret.status = PlayerStatus[ret.status];
    }

    // player is good to go
    return ret;
  } catch (err) {
    logger.error(
      `Error while reloading. playerUuid: ${playerUuid}, gameCode: ${gameCode}, amount: ${chips}: ${errToStr(
        err
      )}`
    );
    throw new GenericError(Errors.RELOAD_FAILED, `Failed to reload`);
  }
}

export async function takeBreak(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new UnauthorizedError();
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
    const now = new Date();
    logger.info(
      `${gameLogPrefix(game)} Player: ${player.uuid}/${
        player.name
      } is taking break at ${now.toISOString()}`
    );

    const takeBreak = new TakeBreak(game, player);
    const status = await takeBreak.takeBreak();
    return status;
  } catch (err) {
    logger.error(
      `Error while taking break. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new GenericError(Errors.TAKEBREAK_FAILED, `Failed to take break`);
  }
}

export async function sitBack(
  playerUuid: string,
  gameCode: string,
  locationCheck?: {
    ip: string;
    location: any;
  }
): Promise<SitBackResponse> {
  if (!playerUuid) {
    throw new UnauthorizedError();
  }
  try {
    // get game using game code
    const game = await GameRepository.getGameByCode(gameCode);
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
    let ip = '';
    let location: any = null;
    if (locationCheck != null) {
      ip = locationCheck.ip;
      location = locationCheck.location;
    }
    logger.info(
      `${gameLogPrefix(game)} Player: ${player.uuid}/${
        player.name
      } sits back. Ip: ${ip} location: ${JSON.stringify(location)}`
    );

    await NextHandUpdatesRepository.sitBack(player, game, ip, location);
    const playerInGame = await PlayersInGameRepository.getPlayerInfo(
      game,
      player
    );
    let resp: any = {};
    if (playerInGame) {
      resp.missedBlind = playerInGame.missedBlind;
      resp.status = PlayerStatus[playerInGame.status];
      return resp;
    }
    return {
      missedBlind: false,
      status: PlayerStatus[PlayerStatus.NOT_PLAYING],
    };
  } catch (err) {
    logger.error(
      `Error while sitting back. playerUuid: ${playerUuid}, gameCode: ${gameCode}, locationCheck: ${JSON.stringify(
        locationCheck
      )}: ${errToStr(err)}`
    );
    if (err instanceof ApolloError) {
      throw err;
    } else {
      throw new GenericError(Errors.JOIN_FAILED, `Sitting back to seat failed`);
    }
  }
}

export async function kickOutPlayer(
  requestUser: string,
  gameCode: string,
  kickedOutPlayer: string
): Promise<boolean> {
  if (!requestUser) {
    throw new UnauthorizedError();
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }

    if (game.clubCode) {
      // club game
      const clubMember = await Cache.getClubMember(requestUser, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${requestUser} is not a club member in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${requestUser} is not authorized to kick out a user`
        );
      }

      if (!(clubMember.isOwner || clubMember.isManager)) {
        // player is not a owner or a manager
        // did this user start the game?
        if (game.hostUuid !== requestUser) {
          logger.error(
            `Player: ${requestUser} cannot kick out a player in game ${gameCode}`
          );
          throw new Error(
            `Player: ${requestUser} cannot kick out a player in game ${gameCode}`
          );
        }
      }
    } else {
      // hosted by individual user
      if (game.hostUuid !== requestUser) {
        logger.error(
          `Player: ${requestUser} cannot kick out a player in game ${gameCode}`
        );
        throw new Error(
          `Player: ${requestUser} cannot kick out a player in game ${gameCode}`
        );
      }
    }

    const player = await Cache.getPlayer(kickedOutPlayer);
    logger.info(
      `${gameLogPrefix(game)} Player: ${player.uuid}/${
        player.name
      } is being kicked out`
    );
    await PlayersInGameRepository.kickOutPlayer(gameCode, player);
    return true;
  } catch (err) {
    logger.error(
      `Error while kicking player out. requestUser: ${requestUser}, gameCode: ${gameCode}, kickedOutPlayer: ${kickedOutPlayer}: ${errToStr(
        err
      )}`
    );
    throw new Error('Failed to kick out player');
  }
}

export async function sitOutPlayer(
  requestUser: string,
  gameCode: string,
  sitOutPlayer: string
): Promise<boolean> {
  if (!requestUser) {
    throw new UnauthorizedError();
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }

    if (game.clubCode) {
      // club game
      const clubMember = await Cache.getClubMember(requestUser, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${requestUser} is not a club member in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${requestUser} is not authorized to sit out a user`
        );
      }

      if (!(clubMember.isOwner || clubMember.isManager)) {
        // player is not a owner or a manager
        // did this user start the game?
        if (game.hostUuid !== requestUser) {
          logger.error(
            `Player: ${requestUser} cannot sit out a player in game ${gameCode}`
          );
          throw new Error(
            `Player: ${requestUser} cannot sit out a player in game ${gameCode}`
          );
        }
      }
    } else {
      // hosted by individual user
      if (game.hostUuid !== requestUser) {
        logger.error(
          `Player: ${requestUser} cannot sit out a player in game ${gameCode}`
        );
        throw new Error(
          `Player: ${requestUser} cannot sit out a player in game ${gameCode}`
        );
      }
    }

    const player = await Cache.getPlayer(sitOutPlayer);
    logger.info(
      `${gameLogPrefix(game)} Player: ${player.uuid}/${
        player.name
      } is being sit out by admin`
    );
    await PlayersInGameRepository.sitOutPlayer(gameCode, player);
    return true;
  } catch (err) {
    logger.error(
      `Error while sitting player out. requestUser: ${requestUser}, gameCode: ${gameCode}, forceSitOutPlayer: ${sitOutPlayer}: ${errToStr(
        err
      )}`
    );
    throw new Error('Failed to sit out player');
  }
}
export async function setBuyInLimit(
  requestUser: string,
  gameCode: string,
  targetPlayerUuid: string,
  targetPlayerId: number,
  chipsLimit: number
): Promise<boolean> {
  if (!requestUser) {
    throw new UnauthorizedError();
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.hostUuid !== requestUser) {
      logger.error(
        `Player: ${requestUser} cannot set buy-in limit for game ${gameCode}`
      );
      throw new Error(
        `Player: ${requestUser} cannot set buy-in limit for game ${gameCode}`
      );
    }

    let player: Player | undefined;
    if (targetPlayerUuid) {
      player = await Cache.getPlayer(targetPlayerUuid);
    } else if (targetPlayerId) {
      player = await Cache.getPlayerById(targetPlayerId);
    }
    if (!player) {
      throw new Error(
        `Player ${targetPlayerUuid}:${targetPlayerId} is missing`
      );
    }
    const centsLimit = chipsToCents(chipsLimit);
    await PlayersInGameRepository.setBuyInLimit(gameCode, player, centsLimit);
    return true;
  } catch (err) {
    logger.error(
      `Error while setting buy-in limit. requestUser: ${requestUser}, gameCode: ${gameCode}, targetPlayer: ${targetPlayerUuid}: ${errToStr(
        err
      )}`
    );
    throw new Error('Failed to set buy-in limit');
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
    logger.info(
      `${gameLogPrefix(game)} Player: ${player.uuid}/${
        player.name
      } is leaving game`
    );
    const status = await NextHandUpdatesRepository.leaveGame(player, game);
    return status;
  } catch (err) {
    logger.error(
      `Error while leaving game. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new GenericError(Errors.LEAVE_GAME_FAILED, `Failed to leave game`);
  }
}

export async function dealerChoice(
  playerId: string,
  gameCode: string,
  gameTypeStr: string,
  doubleBoard: boolean
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    const gameType: GameType = GameType[gameTypeStr];
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }
    const player = await Cache.getPlayer(playerId);
    if (!doubleBoard) {
      doubleBoard = false;
    }
    await GameRepository.updateDealerChoice(
      game,
      player,
      gameType,
      doubleBoard
    );
  } catch (err) {
    logger.error(
      `Error while updating dealer choice. playerId: ${playerId}, gameCode: ${gameCode}, gameTypeStr: ${gameTypeStr}: ${errToStr(
        err
      )}`
    );
    throw new GenericError(
      Errors.DEALER_CHOICE_FAILED,
      `Failed to update set dealer choice`
    );
  }
}

export async function postBlind(
  playerId: string,
  gameCode: string
): Promise<boolean> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }
    const player = await Cache.getPlayer(playerId);
    await PlayersInGameRepository.postBlind(game, player);
    return true;
  } catch (err) {
    logger.error(
      `Error while posting blind. playerId: ${playerId}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new GenericError(Errors.POSTBLIND_FAILED, `Failed to post blind`);
  }
}

export function getResolvers() {
  return resolvers;
}

export async function autoReload(
  requestUser: string,
  gameCode: string,
  reloadThreshold: number,
  reloadTo: number
): Promise<boolean> {
  if (!requestUser) {
    throw new Error('Unauthorized');
  }
  try {
    const player = await Cache.getPlayer(requestUser);
    if (!player) {
      throw new Error(`Player ${requestUser} is not found`);
    }

    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    const gameSettings = await Cache.getGameSettings(game.gameCode);
    if (gameSettings.buyInLimit === BuyInApprovalLimit.BUYIN_HOST_APPROVAL) {
      throw new Error(`Only No limit and credit limit games allow auto reload`);
    }
    reloadThreshold = chipsToCents(reloadThreshold);
    reloadTo = chipsToCents(reloadTo);
    await PlayersInGameRepository.autoReload(
      game,
      player,
      reloadThreshold,
      reloadTo
    );

    return true;
  } catch (err) {
    logger.error(`Error when setting auto reload: ${errToStr(err)}`);
    throw new GenericError(
      Errors.AUTORELOAD_SET_FAILED,
      `Error when setting auto reload`
    );
  }
}

export async function autoReloadOff(
  requestUser: string,
  gameCode: string
): Promise<boolean> {
  if (!requestUser) {
    throw new Error('Unauthorized');
  }
  try {
    const player = await Cache.getPlayer(requestUser);
    if (!player) {
      throw new Error(`Player ${requestUser} is not found`);
    }

    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    const gameSettings = await Cache.getGameSettings(game.gameCode);
    if (gameSettings.buyInLimit === BuyInApprovalLimit.BUYIN_HOST_APPROVAL) {
      throw new Error(`Only No limit and credit limit games allow auto reload`);
    }
    await PlayersInGameRepository.autoReloadOff(game, player);

    return true;
  } catch (err) {
    logger.error(`Error when setting auto reload: ${errToStr(err)}`);
    throw new GenericError(
      Errors.AUTORELOAD_SET_FAILED,
      `Error when setting auto reload`
    );
  }
}
