import {v4 as uuidv4} from 'uuid';
import {GameRepository} from '@src/repositories/game';
import {
  GameStatus,
  GameType,
  PlayerStatus,
  TableStatus,
  BuyInApprovalStatus,
  ApprovalType,
  ApprovalStatus,
  SeatStatus,
  GameEndReason,
  ChipUnit,
  BuyInApprovalLimit,
} from '@src/entity/types';
import {getLogger, errToStr} from '@src/utils/log';
import {Cache} from '@src/cache/index';
import {default as _} from 'lodash';
import {BuyIn} from '@src/repositories/buyin';
import {gameLogPrefix, PokerGame} from '@src/entity/game/game';
import {fillSeats} from '@src/botrunner';
import {ClubRepository} from '@src/repositories/club';
import {getCurrentHandLog} from '@src/gameserver';
import {isHostOrManagerOrOwner} from './util';
import {processPendingUpdates} from '@src/repositories/pendingupdates';
import {PageOptions, pendingApprovalsForClubData} from '@src/types';
import {JanusSession, JANUS_SECRET, JANUS_TOKEN} from '@src/janus';
import {ClubUpdateType} from '@src/repositories/types';
import {Nats} from '@src/nats';
import {Reload} from '@src/repositories/reload';
import {getAgoraAppId} from '@src/3rdparty/agora';
import {GameSettingsRepository} from '@src/repositories/gamesettings';
import {PlayersInGameRepository} from '@src/repositories/playersingame';
import {GameUpdatesRepository} from '@src/repositories/gameupdates';
import {NextHandUpdatesRepository} from '@src/repositories/nexthand_update';
import {Metrics} from '@src/internal/metrics';
import {gameSettings} from './gamesettings';
import {
  Errors,
  GameCreationError,
  GameNotFoundError,
  GenericError,
  UnauthorizedError,
} from '@src/errors';
import {Firebase} from '@src/firebase';
import {centsToChips, chipsToCents} from '@src/utils';
import {Livekit} from '@src/livekit';

const logger = getLogger('resolvers::game');

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
  const startTime = new Date().getTime();
  let createGameTime;

  try {
    createGameTime = new Date().getTime();
    const club = await Cache.getClub(clubCode);
    if (!club) {
      logger.error(
        `Could not configure game. Club does not exist. Club: ${clubCode}`
      );
      throw new Error('Unauthorized');
    }
    const clubMember = await Cache.getClubMember(playerId, clubCode);
    if (!clubMember) {
      logger.error(
        `Could not configure game. Player is not a member. Player: ${playerId}, club: ${clubCode}`
      );
      throw new Error('Unauthorized');
    }
    if (!clubMember.isOwner && !clubMember.isManager) {
      logger.error(
        `Could not configure game. Player is not an owner or a manager. Player: ${playerId}, club: ${clubCode}`
      );
      throw new Error('Unauthorized');
    }
    const player = await Cache.getPlayer(playerId, true);
    const gameInServerUnits = gameInputToServerUnits(game);

    const gameInfo = await GameRepository.createPrivateGame(
      club,
      player,
      gameInServerUnits
    );
    const cachedGame = await Cache.getGame(gameInfo.gameCode, true);
    if (!cachedGame) {
      throw new GameNotFoundError(gameInfo.gameCode);
    }

    Metrics.incNewGame();
    createGameTime = new Date().getTime() - createGameTime;
    logger.info(
      `[${gameLogPrefix(cachedGame)}] Game ${gameInfo.gameCode} is created.`
    );
    const ret: any = gameInfo as any;
    ret.gameType = GameType[gameInfo.gameType];
    ret.status = GameStatus[gameInfo.status];
    ret.tableStatus = TableStatus[gameInfo.tableStatus];
    ret.gameID = gameInfo.id;
    const messageId = uuidv4();
    Nats.sendClubUpdate(
      clubCode,
      club.name,
      ClubUpdateType[ClubUpdateType.NEW_GAME],
      messageId
    );
    Firebase.newGame(
      club,
      gameInfo.gameType,
      gameInfo.smallBlind,
      gameInfo.bigBlind,
      messageId
    );
    return gameInfoToClientUnits(ret);
  } catch (err) {
    logger.error(
      `Error while configuring game. playerId: ${playerId}, clubCode: ${clubCode}, game: ${JSON.stringify(
        game
      )}: ${errToStr(err)}`
    );
    throw new GameCreationError('UNKNOWN');
  }
}

function gameInputToServerUnits(input: any) {
  const game = {...input};
  if (game.smallBlind) {
    game.smallBlind = chipsToCents(game.smallBlind);
  }
  if (game.bigBlind) {
    game.bigBlind = chipsToCents(game.bigBlind);
  }
  if (game.straddleBet) {
    game.straddleBet = chipsToCents(game.straddleBet);
  }
  if (game.rakeCap) {
    game.rakeCap = chipsToCents(game.rakeCap);
  }
  if (game.buyInMin) {
    game.buyInMin = chipsToCents(game.buyInMin);
  }
  if (game.buyInMax) {
    game.buyInMax = chipsToCents(game.buyInMax);
  }
  if (game.ante) {
    game.ante = chipsToCents(game.ante);
  }
  return game;
}

function gameInfoToClientUnits(input: any) {
  const resp = {...input};
  if (resp.smallBlind) {
    resp.smallBlind = centsToChips(resp.smallBlind);
  }
  if (resp.bigBlind) {
    resp.bigBlind = centsToChips(resp.bigBlind);
  }
  if (resp.straddleBet) {
    resp.straddleBet = centsToChips(resp.straddleBet);
  }
  if (resp.rakeCap) {
    resp.rakeCap = centsToChips(resp.rakeCap);
  }
  if (resp.buyInMin) {
    resp.buyInMin = centsToChips(resp.buyInMin);
  }
  if (resp.buyInMax) {
    resp.buyInMax = centsToChips(resp.buyInMax);
  }
  if (resp.rakeCollected) {
    resp.rakeCollected = centsToChips(resp.rakeCollected);
  }
  return resp;
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
    const player = await Cache.getPlayer(playerId);
    const gameInServerUnits = gameInputToServerUnits(game);
    const gameInfo = await GameRepository.createPrivateGame(
      null,
      player,
      gameInServerUnits
    );
    const cachedGame = await Cache.getGame(gameInfo.gameCode, true);
    if (!cachedGame) {
      throw new GameNotFoundError(gameInfo.gameCode);
    }
    logger.info(
      `[${gameLogPrefix(cachedGame)}] Game ${gameInfo.gameCode} is created.`
    );
    Metrics.incNewGame();
    const ret: any = gameInfo as any;
    ret.gameType = GameType[gameInfo.gameType];

    if (gameInServerUnits.demoGame) {
      try {
        await fillSeats('', cachedGame.id, cachedGame.gameCode, true);
      } catch (err) {
        throw new Error('Cannot start the bot game');
      }
    }

    return gameInfoToClientUnits(ret);
  } catch (err) {
    logger.error(
      `Error while configuring game by player. playerId: ${playerId}, game: ${JSON.stringify(
        game
      )}: ${errToStr(err)}`
    );
    throw new GameCreationError('UNKNOWN');
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
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }
    const player = await Cache.getPlayer(playerId);

    const isAuthorized = await isHostOrManagerOrOwner(playerId, game);
    if (!isAuthorized) {
      logger.error(
        `[${gameLogPrefix(
          game
        )}] Player: ${playerId} is not a owner or a manager ${
          game.clubName
        }. Cannot end the game`
      );
      throw new UnauthorizedError();
    }
    logger.info(`[${gameLogPrefix(game)}] Game ended by the host`);
    const status = await GameRepository.endGame(
      player,
      game,
      GameEndReason.HOST_TERMINATED,
      false
    );
    return GameStatus[status];
  } catch (err) {
    logger.error(
      `Error while ending game. playerId: ${playerId}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw err;
  }
}

export async function startGame(
  playerUuid: string,
  gameCode: string
): Promise<string> {
  if (!playerUuid) {
    throw new UnauthorizedError();
  }
  try {
    let gameNum = 0;
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
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

      if (playerUuid !== game.hostUuid) {
        // only host can start the game
        logger.error(
          `Could not start game. Request player is not the game host. Player: ${playerUuid}, game ${gameCode}`
        );
        throw new UnauthorizedError();
      }

      gameNum = await ClubRepository.getNextGameNum(game.clubId);
    }
    logger.info(
      `[${gameLogPrefix(game)}] Game start by the host. Bot game: ${
        game.botGame
      }`
    );

    let players = await PlayersInGameRepository.getPlayersInSeats(game.id);
    let humanPlayers = players.length;
    if (game.botGame && players.length < game.maxPlayers) {
      // fill the empty seats with bots
      await fillSeats(game.clubCode, game.id, game.gameCode);

      let allFilled = false;
      while (!allFilled) {
        await new Promise(r => setTimeout(r, 1000));
        players = await PlayersInGameRepository.getPlayersInSeats(game.id);

        // if (players.length > humanPlayers) {
        //   break;
        // }

        if (players.length !== game.maxPlayers) {
          logger.debug(
            `[${gameLogPrefix(game)}] Waiting for bots to take empty seats`
          );
        } else {
          allFilled = true;
        }
      }
    }
    players = await PlayersInGameRepository.getPlayersInSeats(game.id);
    const status = await GameRepository.markGameActive(game.id, gameNum);
    // game is started
    return GameStatus[status];
  } catch (err) {
    logger.error(
      `Error while starting game. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new Error(`Failed to start the game. ${JSON.stringify(err)}`);
  }
}

export async function pendingApprovalsForGame(
  hostUuid: string,
  gameCode: string
) {
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
      const clubHost = await Cache.getClubMember(hostUuid, game.clubCode);
      if (!clubHost || !(clubHost.isManager || clubHost.isOwner)) {
        logger.error(
          `Player: ${hostUuid} is not authorized to approve buyIn in club ${game.clubName}`
        );
        throw new UnauthorizedError();
      }
    }
    logger.debug(`[${gameLogPrefix(game)}] Fetching buyin approval requests`);

    const player = await Cache.getPlayer(hostUuid);

    const buyin = new BuyIn(game, player);
    const resp = await buyin.pendingApprovalsForGame();
    const ret = new Array<any>();
    for (const item of resp) {
      const itemRet = item as any;
      itemRet.gameType = GameType[item.gameType];
      ret.push(itemRet);
    }

    return pendingApprovalsToClientUnits(ret);
  } catch (err) {
    logger.error(
      `Error in pendingApprovalsForGame. hostUuid: ${hostUuid}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new Error(
      `Failed to get pending approvals list. ${JSON.stringify(err)}`
    );
  }
}

export async function pendingApprovalsForClub(
  hostUuid: string,
  clubCode: string
) {
  if (!hostUuid) {
    throw new Error('Unauthorized');
  }
  try {
    const clubHost = await Cache.getClubMember(hostUuid, clubCode);
    if (!clubHost || !(clubHost.isManager || clubHost.isOwner)) {
      logger.error(
        `Player: ${hostUuid} is not authorized to approve buyIn in club ${clubCode}`
      );
      throw new Error(
        `Player: ${hostUuid} is not authorized to approve buyIn in club ${clubCode}`
      );
    }

    const player = await Cache.getPlayer(hostUuid);
    const club = await Cache.getClub(clubCode);
    logger.debug(`Fetching buyin approval requests`);

    const buyin = new BuyIn(new PokerGame(), player);
    const resp = await buyin.pendingApprovalsForClub();
    const ret = new Array<any>();
    for (const item of resp) {
      const itemRet = item as any;
      itemRet.gameType = GameType[item.gameType];
      ret.push(itemRet);
    }

    return pendingApprovalsToClientUnits(ret);
  } catch (err) {
    logger.error(
      `Error in pendingApprovalsForClub. hostUuid: ${hostUuid}, clubCode: ${clubCode}: ${errToStr(
        err
      )}`
    );
    throw new Error(
      `Failed to fetch approval requests. ${JSON.stringify(err)}`
    );
  }
}

function pendingApprovalsToClientUnits(input: Array<any>): any {
  const resp = new Array<any>();
  for (const i of input) {
    const r = {...i};
    r.amount = centsToChips(r.amount);
    if (r.availableCredit) {
      r.availableCredit = centsToChips(r.availableCredit);
    }
    r.smallBlind = centsToChips(r.smallBlind);
    r.bigBlind = centsToChips(r.bigBlind);
    resp.push(r);
  }

  return resp;
}

export async function approveRequest(
  hostUuid: string,
  playerUuid: string,
  gameCode: string,
  type: ApprovalType,
  status: ApprovalStatus
) {
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
      const clubMember = await Cache.getClubMember(playerUuid, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
      const clubHost = await Cache.getClubMember(hostUuid, game.clubCode);
      if (!clubHost || !(clubHost.isManager || clubHost.isOwner)) {
        logger.error(
          `Player: ${hostUuid} is not authorized to approve buyIn in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${hostUuid} is not authorized to approve buyIn in club ${game.clubName}`
        );
      }
    }

    const player = await Cache.getPlayer(playerUuid);
    logger.info(
      `[${gameLogPrefix(game)}] Approve buyin request. ${player.uuid}`
    );

    let resp: boolean;
    if (type == ApprovalType.RELOAD_REQUEST) {
      const reload = new Reload(game, player);
      resp = await reload.approveDeny(status);
    } else {
      const buyin = new BuyIn(game, player);
      resp = await buyin.approve(type, status);
    }
    return resp;
  } catch (err) {
    logger.error(
      `Error while approving request. hostUuid: ${hostUuid}, playerUuid: ${playerUuid}, gameCode: ${gameCode}, type: ${type}, status: ${status}: ${errToStr(
        err
      )}`
    );
    throw new GenericError(
      Errors.BUYIN_ERROR,
      `${gameCode} Buyin approval failed`
    );
  }
}

export async function myGameState(playerUuid: string, gameCode: string) {
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
    const data = await GameRepository.myGameState(player, game);

    const gameState = {
      playerUuid: player.uuid,
      buyIn: data.buyIn,
      stack: data.stack,
      status: PlayerStatus[data.status],
      buyInStatus: BuyInApprovalStatus[data.status],
      playingFrom: data.satAt,
      seatNo: data.seatNo,
    };

    return gameStateToClientUnits(gameState);
  } catch (err) {
    logger.error(
      `Error in myGameState. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new Error(`Failed to get game state. ${JSON.stringify(err)}`);
  }
}

function gameStateToClientUnits(input: any): any {
  const r = {...input};
  r.buyIn = centsToChips(r.buyIn);
  r.stack = centsToChips(r.stack);
  return r;
}

export async function tableGameState(playerUuid: string, gameCode: string) {
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
    const gameState = await GameRepository.tableGameState(game);

    const tableGameState = new Array<any>();
    gameState.map(data => {
      const gameState = {
        playerUuid: data.playerUuid,
        buyIn: data.buyIn,
        stack: data.stack,
        status: PlayerStatus[data.status],
        buyInStatus: BuyInApprovalStatus[data.status],
        playingFrom: data.satAt,
        seatNo: data.seatNo,
      };
      tableGameState.push(gameStateToClientUnits(gameState));
    });

    return tableGameState;
  } catch (err) {
    logger.error(
      `Error while getting table game state. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new Error(`Failed to get game state. ${JSON.stringify(err)}`);
  }
}

export async function getGameInfo(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode, true);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }
    let clubCode = '';
    let isHost = false;
    let isManager = false;
    let isOwner = false;
    if (game.clubCode) {
      const clubMember = await Cache.getClubMember(playerUuid, game.clubCode);
      clubCode = game.clubCode;
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode} in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode}`
        );
      }

      isOwner = clubMember.isOwner;
      isManager = clubMember.isManager;
    }

    const player = await Cache.getPlayer(playerUuid);

    const ret = _.cloneDeep(game) as any;

    if (ret.host) {
      if (ret.host.uuid === playerUuid) {
        isHost = true;
      }
    }

    if (ret.startedBy) {
      ret.startedBy = ret.startedBy.name;
    }
    ret.clubCode = clubCode;
    ret.gameType = GameType[game.gameType];
    ret.tableStatus = TableStatus[game.tableStatus];
    ret.status = GameStatus[game.status];
    ret.chipUnit = ChipUnit[game.chipUnit];
    ret.gameID = game.id;
    ret.agoraAppId = getAgoraAppId();

    ret.livekitUrl = game.livekitUrl;
    ret.livekitToken = Livekit.getToken(game.livekitUrl, gameCode, player.id);

    const updates = await GameUpdatesRepository.get(game.gameCode);
    const settings = await GameSettingsRepository.get(game.gameCode);
    if (updates && settings) {
      ret.buyInLimit = BuyInApprovalLimit[settings.buyInLimit];
      ret.waitlistAllowed = settings.waitlistAllowed;
      ret.useAgora = settings.useAgora;
      ret.audioConfEnabled = settings.audioConfEnabled;
      ret.rakeCollected = updates.rake;
      ret.handNum = updates.handNum;
      ret.janusRoomId = settings.janusRoomId;
      ret.janusRoomPin = settings.janusRoomPin;
      ret.runItTwiceAllowed = settings.runItTwiceAllowed;
      ret.bombPotEnabled = settings.bombPotEnabled;
      if (ret.bombPotEnabled) {
        ret.bombPotBet = settings.bombPotBet;
        ret.doubleBoardBombPot = settings.doubleBoardBombPot;
        ret.bombPotInterval = Math.floor(settings.bombPotInterval / 60);
        ret.bombPotIntervalInSecs = settings.bombPotInterval;
      }
      ret.ipCheck = settings.ipCheck;
      ret.gpsCheck = settings.gpsCheck;
      ret.showResult = settings.showResult;
    }
    const now = new Date().getTime();
    // get player's game state
    const playerState = await PlayersInGameRepository.getGamePlayerState(
      game,
      player
    );
    if (playerState) {
      ret.gameToken = playerState.gameToken;
      ret.playerGameStatus = PlayerStatus[playerState.status];
      ret.playerMuckLosingHandConfig = playerState.muckLosingHand;
      ret.playerRunItTwiceConfig = playerState.runItTwiceEnabled;

      if (!playerState.audioToken) {
        ret.agoraToken = playerState.audioToken;
      }

      ret.sessionTime = 0;
      logger.debug(
        `Session time: ${playerState.sessionTime} satAt: ${playerState.satAt}`
      );
      if (
        playerState.sessionTime === undefined ||
        playerState.sessionTime === null
      ) {
        playerState.sessionTime = 0;
      }
      if (playerState.satAt) {
        const sessionTime = Math.round(
          (now - playerState.satAt.getTime()) / 1000
        );
        ret.sessionTime = playerState.sessionTime + sessionTime;
      }
      ret.noHandsPlayed = playerState.noHandsPlayed;
      ret.noHandsWon = playerState.noHandsWon;
      ret.buyin = centsToChips(playerState.buyIn);
      ret.stack = centsToChips(playerState.stack);
    }
    const runningTime = Math.round((now - game.startedAt.getTime()) / 1000);
    ret.runningTime = runningTime;

    ret.gameToPlayerChannel = Nats.getGameChannel(game.gameCode);
    ret.playerToHandChannel = Nats.getPlayerToHandChannel(game.gameCode);
    ret.handToAllChannel = Nats.getHandToAllChannel(game.gameCode);
    ret.handToPlayerChannel = Nats.getPlayerHandChannel(
      game.gameCode,
      player.id
    );
    ret.handToPlayerTextChannel = Nats.getPlayerHandTextChannel(
      game.gameCode,
      player.id
    );
    ret.gameChatChannel = Nats.getChatChannel(game.gameCode);
    ret.clientAliveChannel = Nats.getClientAliveChannel(game.gameCode);

    // player's role
    ret.isManager = isManager;
    ret.isHost = isHost;
    ret.isOwner = isOwner;

    // janus info
    ret.janusUrl = JanusSession.janusUrl();
    ret.janusSecret = JANUS_SECRET;
    ret.janusToken = JANUS_TOKEN;

    const resp = gameInfoToClientUnits(ret);
    return resp;
  } catch (err) {
    logger.error(
      `Error while getting game info. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new Error(`Failed to get game information: ${errToStr(err)}`);
  }
}

async function getPlayerRole(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }
    let clubCode = '';
    let isHost = false;
    let isManager = false;
    let isOwner = false;
    if (game.clubCode) {
      const clubMember = await Cache.getClubMember(playerUuid, game.clubCode);
      clubCode = game.clubCode;
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode} in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode}`
        );
      }

      isOwner = clubMember.isOwner;
      isManager = clubMember.isManager;
    }

    const player = await Cache.getPlayer(playerUuid);
    if (game.hostUuid) {
      if (game.hostUuid == playerUuid) {
        isHost = true;
      }
    }
    // player's role
    const ret: any = {};
    ret.isManager = isManager;
    ret.isHost = isHost;
    ret.isOwner = isOwner;

    return ret;
  } catch (err) {
    logger.error(
      `Error while getting player role. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new Error(`Failed to get game information: ${errToStr(err)}`);
  }
}

export async function assignHost(
  requestUser: string,
  gameCode: string,
  newHostPlayerUuid: string,
  newHostPlayerId: number
): Promise<boolean> {
  if (!requestUser) {
    throw new Error('Unauthorized');
  }
  try {
    if (requestUser === newHostPlayerUuid) {
      throw new Error('Cannot assign oneself to game host');
    }

    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.hostUuid !== requestUser) {
      throw new Error(
        `Player: ${requestUser} cannot assign game host in game ${gameCode}. Only the current host (${game.hostUuid}) can assign new game host.`
      );
    }

    const oldHostPlayer = await Cache.getPlayer(requestUser);
    let newHostPlayer;
    if (newHostPlayerUuid) {
      newHostPlayer = await Cache.getPlayer(newHostPlayerUuid);
    } else if (newHostPlayerId) {
      newHostPlayer = await Cache.getPlayerById(newHostPlayerId);
    }
    logger.info(
      `[${gameLogPrefix(game)}] Host is changed from ${oldHostPlayer.uuid}/${
        oldHostPlayer.name
      } to ${newHostPlayer.uuid}/${newHostPlayer.name}`
    );
    await PlayersInGameRepository.assignNewHost(
      gameCode,
      oldHostPlayer,
      newHostPlayer
    );
    return true;
  } catch (err) {
    logger.error(
      `Error while assigning game host. requestUser: ${requestUser}, gameCode: ${gameCode}, new host player: ${newHostPlayerUuid}: ${errToStr(
        err
      )}`
    );
    throw new GenericError(
      Errors.ASSIGN_HOST_FAILED,
      `Error while assigning game host. requestUser: ${requestUser}, gameCode: ${gameCode}, new host player: ${newHostPlayerUuid}`
    );
  }
}

export async function pauseGame(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }
    const player = await Cache.getPlayer(playerId);
    const isAuthorized = await isHostOrManagerOrOwner(playerId, game);
    if (!isAuthorized) {
      logger.error(
        `Player: ${playerId} is not a owner or a manager ${game.clubName}. Cannot pause game`
      );
      throw new Error(
        `Player: ${playerId} is not a owner or a manager ${game.clubName}. Cannot pause game`
      );
    }
    logger.info(
      `[${gameLogPrefix(game)}] Host ${player.name}:${
        player.uuid
      } is requesting to pause the game`
    );

    if (
      game.status === GameStatus.ACTIVE &&
      game.tableStatus === TableStatus.GAME_RUNNING
    ) {
      // the game will be stopped in the next hand
      await NextHandUpdatesRepository.pauseGameNextHand(game.id);
      logger.info(`[${gameLogPrefix(game)}] will be paued next hand`);
    } else {
      const status = await GameRepository.markGameStatus(
        game.id,
        GameStatus.PAUSED
      );
      logger.info(`[${gameLogPrefix(game)}] is paued`);
      return GameStatus[status];
    }
    return GameStatus[game.status];
  } catch (err) {
    logger.error(
      `Error while pausing game. playerId: ${playerId}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new Error('Failed to pause the game. ' + errToStr(err));
  }
}

export async function resumeGame(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }

    const isAuthorized = await isHostOrManagerOrOwner(playerId, game);
    if (!isAuthorized) {
      logger.error(
        `Player: ${playerId} is not a owner or a manager ${game.clubName}. Cannot resume game`
      );
      throw new Error(
        `Player: ${playerId} is not a owner or a manager ${game.clubName}. Cannot resume game`
      );
    }

    if (game.status === GameStatus.PAUSED) {
      const player = await Cache.getPlayer(playerId);
      logger.info(
        `[${gameLogPrefix(game)}] Host ${player.name}:${
          player.uuid
        } is requesting to pause the game`
      );
      const status = await GameRepository.markGameStatus(
        game.id,
        GameStatus.ACTIVE
      );
      await processPendingUpdates(game.id);
      return GameStatus[status];
    }
    return GameStatus[game.status];
  } catch (err) {
    logger.error(
      `Error while resuming game. playerId: ${playerId}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new Error(
      `Failed to resume game:  ${errToStr(err)}. Game code: ${gameCode}`
    );
  }
}

export async function openSeats(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }

    return PlayersInGameRepository.openSeats(game);
  } catch (err) {
    logger.error(
      `Error while getting open seats. playerId: ${playerId}, gameCode: ${gameCode}: ${errToStr(
        err
      )}`
    );
    throw new Error(
      `Failed to resume game:  ${errToStr(err)}. Game code: ${gameCode}`
    );
  }
}

async function playersWithNotes(
  playerId: string,
  gameCode: string
): Promise<Array<any>> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  return GameRepository.getPlayersWithNotes(playerId, gameCode);
}

export async function getLobbyGames(
  playerId: string,
  pageOptions?: PageOptions
): Promise<Array<any>> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }

  let lobbyGames = await GameRepository.getLobbyGames();
  const ret = new Array<any>();

  if(lobbyGames.length == 0) {
   await GameRepository.refreshLobbyGames();
   lobbyGames = await GameRepository.getLobbyGames();
  }

  for (const game of lobbyGames) {
    const retGame = {...(game as any)};

    if (!game.endedBy) {
      game.endedBy = '';
    }
    retGame.gameType = GameType[game.gameType];

    retGame.dealerChoiceGames = [];
    if (game.dealerChoiceGames) {
      retGame.dealerChoiceGames = game.dealerChoiceGames.split(',');
    }
    retGame.roeGames = [];
    if (game.roeGames) {
      retGame.roeGames = game.roeGames.split(',');
    }
    ret.push(retGame);
  }
  // convert club games to PlayerClubGame
  return lobbyGamesToClientUnits(ret);
}

function lobbyGamesToClientUnits(input: Array<any>): any {
  const resp = new Array<any>();
  for (const i of input) {
    const r = {...i};
    r.smallBlind = centsToChips(r.smallBlind);
    r.bigBlind = centsToChips(r.bigBlind);
    r.balance = centsToChips(r.balance);
    resp.push(r);
  }

  return resp;
}

const resolvers: any = {
  Query: {
    gameById: async (parent, args, ctx, info) => {
      const game = await Cache.getGame(args.gameCode);
      if (!game) {
        throw new GameNotFoundError(args.gameCode);
      }
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
    playerRole: async (parent, args, ctx, info) => {
      return await getPlayerRole(ctx.req.playerId, args.gameCode);
    },
    pendingApprovalsForClub: async (parent, args, ctx, info) => {
      return await pendingApprovalsForClub(ctx.req.playerId, args.clubCode);
    },
    pendingApprovalsForGame: async (parent, args, ctx, info) => {
      return await pendingApprovalsForGame(ctx.req.playerId, args.gameCode);
    },
    pendingApprovals: async (parent, args, ctx, info) => {
      return await pendingApprovals(ctx.req.playerId);
    },
    playersWithNotes: async (parent, args, ctx, info) => {
      return await playersWithNotes(ctx.req.playerId, args.gameCode);
    },
    // completedGames: async (parent, args, ctx, info) => {
    //   return await completedGame(ctx.req.playerId, args.gameCode);
    // },
    currentHandLog: async (parent, args, ctx, info) => {
      const game = await Cache.getGame(args.gameCode);
      if (!game) {
        throw new GameNotFoundError(args.gameCode);
      }

      logger.info(`Getting current hand log for ${args.gameCode}`);
      return getCurrentHandLog(game.id);
    },
    openSeats: async (parent, args, ctx, info) => {
      return await openSeats(ctx.req.playerId, args.gameCode);
    },

    lobbyGames: async (parent, args, ctx, info) => {
      return getLobbyGames(ctx.req.playerId, args.page);
    },
  },
  GameInfo: {
    settings: async (parent, args, ctx, info) => {
      const settings = await gameSettings(ctx.req.playerId, args.gameCode);
      return settings;
    },
    seatInfo: async (parent, args, ctx, info) => {
      const game = await Cache.getGame(parent.gameCode);
      if (!game) {
        throw new GameNotFoundError(parent.gameCode);
      }

      const seatStatuses = await GameRepository.getSeatStatus(game.id);
      const players = await PlayersInGameRepository.getPlayersInSeats(game.id);
      const playersInSeats = new Array<any>();
      for (const player of players) {
        const playerInSeat = player as any;
        playerInSeat.status = PlayerStatus[player.status];
        playerInSeat.name = player.playerName;
        playerInSeat.buyInExpTime = player.buyInExpAt;
        playerInSeat.breakExpTime = player.breakTimeExpAt;
        const playerInfo = await Cache.getPlayer(player.playerUuid);
        playerInSeat.isBot = playerInfo.bot;
        /* settings */
        /*
          type GamePlayerSettings {
            autoStraddle: Boolean
            straddle: Boolean
            buttonStraddle: Boolean
            bombPotEnabled: Boolean
            muckLosingHand: Boolean
            runItTwiceEnabled: Boolean
          }
        */
        playerInSeat.settings = {
          autoStraddle: player.autoStraddle,
          buttonStraddle: player.buttonStraddle,
          bombPotEnabled: player.bombPotEnabled,
          muckLosingHand: player.muckLosingHand,
          runItTwiceEnabled: player.runItTwiceEnabled,
        };
        playersInSeats.push(playerInSeat);
      }

      const seats = new Array<any>();
      const takenSeats = playersInSeats.map(x => x.seatNo);
      const availableSeats: Array<number> = [];

      /*
          type SeatInfo {
            seatNo: Int!
            playerUuid: String
            playerId: Int
            name: String
            buyIn: Float
            stack: Float
            status: PlayerGameStatus
            seatStatus: SeatStatus
            buyInExpTime: DateTime
            breakStartedTime: DateTime
            breakExpTime: DateTime
            gameToken: String
            agoraToken: String
            isBot: Boolean
          }
      */
      for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
        let seatStatus = SeatStatus.UNKNOWN;
        if (seatStatuses.length >= game.maxPlayers) {
          seatStatus = seatStatuses[seatNo];
        }

        const occupiedSeat = takenSeats.indexOf(seatNo);
        if (occupiedSeat === -1) {
          // is seat reserved ??
          if (seatStatus === SeatStatus.RESERVED) {
            seats.push({
              seatNo: seatNo,
              seatStatus: SeatStatus[SeatStatus.RESERVED],
            });
          } else {
            seats.push({
              seatNo: seatNo,
              seatStatus: SeatStatus[SeatStatus.OPEN],
            });
            availableSeats.push(seatNo);
          }
        } else {
          // seat is occupied
          let player: any;
          for (const p of playersInSeats) {
            if (p.seatNo == seatNo) {
              player = p;
              break;
            }
          }
          if (player) {
            let seat = _.assign({}, player);
            seat.seatStatus = SeatStatus[SeatStatus.OCCUPIED];
            seat.status = PlayerStatus[player.status];
            seat.name = player.playerName;
            seat.buyInExpTime = player.buyInExpAt;
            seat.breakExpTime = player.breakTimeExpAt;
            seats.push(seat);
          }
        }
      }

      const resp = seatInfoToClientUnits({
        playersInSeats: playersInSeats,
        availableSeats: availableSeats,
        seats: seats,
      });
      return resp;
    },
    gameToken: async (parent, args, ctx, info) => {
      const game = await Cache.getGame(parent.gameCode);
      if (!game) {
        throw new GameNotFoundError(parent.gameCode);
      }
      let playerState = ctx['playerState'];
      if (!playerState) {
        const player = await Cache.getPlayer(ctx.req.playerId);
        // get player's game state
        playerState = await PlayersInGameRepository.getGamePlayerState(
          game,
          player
        );
        ctx['playerState'] = playerState;
      }
      if (playerState) {
        return playerState.gameToken;
      }
      return null;
    },
    allPlayers: async (parent, args, ctx, info) => {
      const allPlayersInGame = GameRepository.getAllPlayersInGame(
        parent.gameCode
      );
      return allPlayersInGame;
    },
  },
  Mutation: {
    configureGame: async (parent, args, ctx, info) => {
      return configureGame(ctx.req.playerId, args.clubCode, args.game);
    },
    configureFriendsGame: async (parent, args, ctx, info) => {
      return configureGameByPlayer(ctx.req.playerId, args.game);
    },
    endGame: async (parent, args, ctx, info) => {
      return endGame(ctx.req.playerId, args.gameCode);
    },
    pauseGame: async (parent, args, ctx, info) => {
      return pauseGame(ctx.req.playerId, args.gameCode);
    },
    resumeGame: async (parent, args, ctx, info) => {
      return resumeGame(ctx.req.playerId, args.gameCode);
    },
    approveRequest: async (parent, args, ctx, info) => {
      let approvalType: ApprovalType = ApprovalType.BUYIN_REQUEST;
      const type = ApprovalType[ApprovalType.BUYIN_REQUEST];
      if (args.type === ApprovalType[ApprovalType.BUYIN_REQUEST]) {
        approvalType = ApprovalType.BUYIN_REQUEST;
      } else if (args.type === ApprovalType[ApprovalType.RELOAD_REQUEST]) {
        approvalType = ApprovalType.RELOAD_REQUEST;
      }

      let status: ApprovalStatus = ApprovalStatus.DENIED;
      if (args.status === ApprovalStatus[ApprovalStatus.APPROVED]) {
        status = ApprovalStatus.APPROVED;
      } else if (args.status === ApprovalStatus[ApprovalStatus.DENIED]) {
        status = ApprovalStatus.DENIED;
      }

      return approveRequest(
        ctx.req.playerId,
        args.playerUuid,
        args.gameCode,
        approvalType,
        status
      );
    },
    startGame: async (parent, args, ctx, info) => {
      return startGame(ctx.req.playerId, args.gameCode);
    },
    assignHost: async (parent, args, ctx, info) => {
      return assignHost(
        ctx.req.playerId,
        args.gameCode,
        args.playerUuid,
        args.playerId
      );
    },
  },
};

function seatInfoToClientUnits(input: any): any {
  const seatInfo = {...input};
  for (const s of seatInfo.seats) {
    if (s.buyIn) {
      s.buyIn = centsToChips(s.buyIn);
    }
    if (s.stack) {
      s.stack = centsToChips(s.stack);
    }
  }
  for (const s of seatInfo.playersInSeats) {
    if (s.buyIn) {
      s.buyIn = centsToChips(s.buyIn);
    }
    if (s.stack) {
      s.stack = centsToChips(s.stack);
    }
  }
  for (const s of seatInfo.availableSeats) {
    if (s.buyIn) {
      s.buyIn = centsToChips(s.buyIn);
    }
    if (s.stack) {
      s.stack = centsToChips(s.stack);
    }
  }

  return seatInfo;
}

export async function pendingApprovals(hostUuid: string) {
  if (!hostUuid) {
    throw new Error('Unauthorized');
  }
  try {
    let club;

    const player = await Cache.getPlayer(hostUuid);

    const buyin = new BuyIn(new PokerGame(), player);
    let respClubs: Array<pendingApprovalsForClubData>;
    let respPlayer: Array<pendingApprovalsForClubData>;
    respClubs = await buyin.pendingApprovalsForClub();
    respPlayer = await buyin.pendingApprovalsForPlayer();

    const ret = new Array<any>();
    const added = new Array<number>();
    for (const item of respClubs) {
      const itemRet = item as any;
      itemRet.gameType = GameType[item.gameType];
      ret.push(itemRet);
      added.push(itemRet.requestId);
    }
    for (const item of respPlayer) {
      const itemRet = item as any;
      if (added.indexOf(itemRet.requestId) === -1) {
        itemRet.gameType = GameType[item.gameType];
        ret.push(itemRet);
        added.push(itemRet.requestId);
      }
    }

    return pendingApprovalsToClientUnits(ret);
  } catch (err) {
    logger.error(
      `Error in pendingApprovals. hostUuid: ${hostUuid}: ${errToStr(err)}`
    );
    throw new Error(
      `Failed to fetch approval requests. ${JSON.stringify(err)}`
    );
  }
}

export function getResolvers() {
  return resolvers;
}
