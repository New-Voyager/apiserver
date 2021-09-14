import {v4 as uuidv4} from 'uuid';
import {GameRepository} from '@src/repositories/game';
import {HistoryRepository} from '@src/repositories/history';
import {
  GameStatus,
  GameType,
  PlayerStatus,
  TableStatus,
  BuyInApprovalStatus,
  ApprovalType,
  ApprovalStatus,
  SeatStatus,
} from '@src/entity/types';
import {getLogger, errToLogString} from '@src/utils/log';
import {Cache} from '@src/cache/index';
import {WaitListMgmt} from '@src/repositories/waitlist';
import {default as _} from 'lodash';
import {BuyIn} from '@src/repositories/buyin';
import {PokerGame} from '@src/entity/game/game';
import {GameHistory} from '@src/entity/history/game';
import {fillSeats} from '@src/botrunner';
import {ClubRepository} from '@src/repositories/club';
import {getCurrentHandLog} from '@src/gameserver';
import {isHostOrManagerOrOwner} from './util';
import {processPendingUpdates} from '@src/repositories/pendingupdates';
import {pendingApprovalsForClubData} from '@src/types';
import {ApolloError} from 'apollo-server-express';
import {
  JanusSession,
  JANUS_APISECRET,
  JANUS_SECRET,
  JANUS_TOKEN,
} from '@src/janus';
import {
  ClubUpdateType,
  GamePlayerSettings,
  NewUpdate,
  SitBackResponse,
} from '@src/repositories/types';
import {TakeBreak} from '@src/repositories/takebreak';
import {Player} from '@src/entity/player/player';
import {Nats} from '@src/nats';
import {Reload} from '@src/repositories/reload';
import {PlayersInGame} from '@src/entity/history/player';
import {getAgoraAppId} from '@src/3rdparty/agora';
import {SeatChangeProcess} from '@src/repositories/seatchange';
import {analyticsreporting_v4} from 'googleapis';
import {GameSettingsRepository} from '@src/repositories/gamesettings';
import {PlayersInGameRepository} from '@src/repositories/playersingame';
import {GameUpdatesRepository} from '@src/repositories/gameupdates';
import {NextHandUpdatesRepository} from '@src/repositories/nexthand_update';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const humanizeDuration = require('humanize-duration');

const logger = getLogger('resolvers::game');

export async function configureGame(
  playerId: string,
  clubCode: string,
  game: any
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }

  const club = await Cache.getClub(clubCode);

  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  const startTime = new Date().getTime();
  let createGameTime, audioConfCreateTime;

  try {
    createGameTime = new Date().getTime();
    const club = await Cache.getClub(clubCode);
    const player = await Cache.getPlayer(playerId);
    const gameInfo = await GameRepository.createPrivateGame(club, player, game);
    createGameTime = new Date().getTime() - createGameTime;
    logger.info(`Game ${gameInfo.gameCode} is created.`);
    const ret: any = gameInfo as any;
    ret.gameType = GameType[gameInfo.gameType];
    ret.status = GameStatus[gameInfo.status];
    ret.tableStatus = TableStatus[gameInfo.tableStatus];
    ret.gameID = gameInfo.id;

    ret.janusRoomPin = 'abcd'; // randomize
    ret.janusRoomId = gameInfo.id;
    if (game.audioConfEnabled) {
      audioConfCreateTime = new Date().getTime();
      //logger.info(`Joining Janus audio conference: ${game.id}`);
      try {
        const session = await JanusSession.create(JANUS_APISECRET);
        await session.attachAudio();
        await session.createRoom(ret.janusRoomId, ret.janusRoomPin);
        await GameRepository.updateJanus(
          gameInfo.gameCode,
          gameInfo.id,
          session.getId(),
          session.getHandleId(),
          ret.janusRoomId,
          ret.janusRoomPin
        );
        audioConfCreateTime = new Date().getTime() - audioConfCreateTime;
        const endTime = new Date().getTime();
        logger.debug(
          `Time taken to create a new game: ${ret.gameCode} ${
            endTime - startTime
          }ms  audioConfCreateTime: ${audioConfCreateTime} createGameTime: ${createGameTime}`
        );
      } catch (err) {
        logger.debug(
          `Failed to join Janus audio conference: ${
            game.id
          }. Error: ${err.toString()}`
        );
        await GameRepository.updateAudioConfDisabled(gameInfo.gameCode);
        game.audioConfEnabled = false;
      }
    }
    const messageId = uuidv4();
    Nats.sendClubUpdate(
      clubCode,
      club.name,
      ClubUpdateType[ClubUpdateType.MEW_GAME],
      messageId
    );
    return ret;
  } catch (err) {
    logger.error(
      `Error while configuring game. playerId: ${playerId}, clubCode: ${clubCode}, game: ${JSON.stringify(
        game
      )}: ${errToLogString(err)}`
    );
    throw new Error(
      `Failed to create a new game. ${err.toString()} ${JSON.stringify(err)}`
    );
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
    const player = await Cache.getPlayer(playerId);

    const gameInfo = await GameRepository.createPrivateGame(null, player, game);
    const ret: any = gameInfo as any;
    ret.gameType = GameType[gameInfo.gameType];
    return ret;
  } catch (err) {
    logger.error(
      `Error while configuring game by player. playerId: ${playerId}, game: ${JSON.stringify(
        game
      )}: ${errToLogString(err)}`
    );
    throw new Error(
      `Failed to create a new game. ${err.toString()} ${JSON.stringify(err)}`
    );
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
    const player = await Cache.getPlayer(playerId);

    const isAuthorized = await isHostOrManagerOrOwner(playerId, game);
    if (!isAuthorized) {
      logger.error(
        `Player: ${playerId} is not a owner or a manager ${game.clubName}. Cannot end the game`
      );
      throw new Error(
        `Player: ${playerId} is not a owner or a manager ${game.clubName}. Cannot end the game`
      );
    }

    if (
      game.status === GameStatus.ACTIVE &&
      game.tableStatus === TableStatus.GAME_RUNNING
    ) {
      // the game will be stopped in the next hand
      NextHandUpdatesRepository.endGameNextHand(player, game.id);
    } else {
      await Cache.removeAllObservers(game.gameCode);
      const status = await GameRepository.markGameEnded(game.id);
      return GameStatus[status];
    }
    return GameStatus[game.status];
  } catch (err) {
    logger.error(
      `Error while ending game. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error('Failed to end the game. ' + err.message);
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
    throw new Error('Unauthorized');
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
    }

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
      )}: ${errToLogString(err)}`
    );
    if (err instanceof ApolloError) {
      throw err;
    } else {
      throw new Error(
        `Player: ${playerName} Failed to join the game. ${JSON.stringify(err)}`
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
    return playerInSeat;
  } catch (err) {
    logger.error(
      `Error while taking seat. playerUuid: ${playerUuid}, gameCode: ${gameCode}, seatNo: ${seatNo}, locationCheck: ${JSON.stringify(
        locationCheck
      )}: ${errToLogString(err)}`
    );
    if (err instanceof ApolloError) {
      throw err;
    } else {
      throw new Error(
        `Player: ${playerName} Failed to join the game. ${JSON.stringify(err)}`
      );
    }
  } finally {
    const timeTaken = new Date().getTime() - startTime;
    logger.debug(`joinGame took ${timeTaken} ms`);
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
    let gameNum = 0;
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

      if (!(clubMember.isManager || clubMember.isOwner)) {
        // this player cannot start this game
        logger.error(
          `Player: ${playerUuid} is not manager or owner. The player is not authorized to start the game ${gameCode} in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerUuid} is not manager or owner. The player is not authorized to start the game ${gameCode}`
        );
      }

      gameNum = await ClubRepository.getNextGameNum(game.clubId);
    }

    let players = await PlayersInGameRepository.getPlayersInSeats(game.id);
    if (game.botGame && players.length < game.maxPlayers) {
      // fill the empty seats with bots
      await fillSeats(game.clubCode, game.gameCode);

      let allFilled = false;
      while (!allFilled) {
        await new Promise(r => setTimeout(r, 1000));
        players = await PlayersInGameRepository.getPlayersInSeats(game.id);
        if (players.length !== game.maxPlayers) {
          logger.debug(
            `[${game.gameCode}] Waiting for bots to take empty seats`
          );
        } else {
          allFilled = true;
        }
      }
    }
    players = await PlayersInGameRepository.getPlayersInSeats(game.id);
    // do we have enough players in the table
    // if (players.length <= 1) {
    //   throw new Error('We need more players to start the game');
    // }
    // let playersWithStack = 0;
    // for (const player of players) {
    //   if (player.status === PlayerStatus.PLAYING) {
    //     playersWithStack++;
    //   }
    // }

    // if (playersWithStack <= 1) {
    //   throw new Error('Not enough players with stack to start the game');
    // }

    const status = await GameRepository.markGameActive(game.id, gameNum);
    // game is started
    return GameStatus[status];
  } catch (err) {
    logger.error(
      `Error while starting game. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
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
    const buyin = new BuyIn(game, player);
    const status = await buyin.request(amount);

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
      return resp;
    }
    return {
      missedBlind: false,
      status: PlayerStatus[PlayerStatus.NOT_PLAYING],
      approved: false,
      expireSeconds: status.expireSeconds,
    };
  } catch (err) {
    const timeTaken = new Date().getTime() - startTime;
    logger.error(
      `Error while buying in. playerUuid: ${playerUuid}, gameCode: ${gameCode}, amount: ${amount}: ${errToLogString(
        err
      )}`
    );
    logger.debug(`Buyin took ${timeTaken}ms`);
    throw new Error(`Failed to update buyin. ${err.toString()}`);
  }
}

export async function reload(
  playerUuid: string,
  gameCode: string,
  amount: number
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
    const buyin = new Reload(game, player);
    const status = await buyin.request(amount);
    // player is good to go
    return status;
  } catch (err) {
    logger.error(
      `Error while reloading. playerUuid: ${playerUuid}, gameCode: ${gameCode}, amount: ${amount}: ${errToLogString(
        err
      )}`
    );
    throw new Error(`Failed to update reload. ${JSON.stringify(err)}`);
  }
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

    return ret;
  } catch (err) {
    logger.error(
      `Error in pendingApprovals. hostUuid: ${hostUuid}: ${errToLogString(err)}`
    );
    throw new Error(
      `Failed to fetch approval requests. ${JSON.stringify(err)}`
    );
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
        throw new Error(
          `Player: ${hostUuid} is not authorized to approve buyIn in club ${game.clubName}`
        );
      }
    }

    const player = await Cache.getPlayer(hostUuid);

    const buyin = new BuyIn(game, player);
    const resp = await buyin.pendingApprovalsForGame();
    const ret = new Array<any>();
    for (const item of resp) {
      const itemRet = item as any;
      itemRet.gameType = GameType[item.gameType];
      ret.push(itemRet);
    }

    return ret;
  } catch (err) {
    logger.error(
      `Error in pendingApprovalsForGame. hostUuid: ${hostUuid}, gameCode: ${gameCode}: ${errToLogString(
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

    const buyin = new BuyIn(new PokerGame(), player);
    const resp = await buyin.pendingApprovalsForClub();
    const ret = new Array<any>();
    for (const item of resp) {
      const itemRet = item as any;
      itemRet.gameType = GameType[item.gameType];
      ret.push(itemRet);
    }

    return ret;
  } catch (err) {
    logger.error(
      `Error in pendingApprovalsForClub. hostUuid: ${hostUuid}, clubCode: ${clubCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed to fetch approval requests. ${JSON.stringify(err)}`
    );
  }
}

export async function completedGame(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    const player = await Cache.getPlayer(playerId);

    const resp = await HistoryRepository.getCompletedGame(gameCode, player.id);
    if (game.endedAt) {
      const runTime = resp.endedAt - resp.startedAt;
      resp.runTime = Math.ceil(runTime / (60 * 1000));
      resp.runTimeStr = humanizeDuration(runTime, {round: true});
    }

    if (resp.sessionTime) {
      resp.sessionTime = Math.ceil(resp.sessionTime / (60 * 1000));
      resp.sessionTimeStr = humanizeDuration(resp.sessionTime * 1000, {
        round: true,
      });
    }
    if (!resp.endedBy) {
      resp.endedBy = '';
    }

    resp.status = GameStatus[resp.status];
    resp.gameType = GameType[resp.gameType];
    return resp;
  } catch (err) {
    logger.error(
      `Error while getting completed game. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(`Failed to get game information. ${JSON.stringify(err)}`);
  }
}

export async function getGameResultTable(gameCode: string) {
  try {
    const game = await Cache.getGame(gameCode);
    let resp: Array<any> = [];
    if (!game || game.status === GameStatus.ENDED) {
      resp = await HistoryRepository.getGameResultTable(gameCode);
    } else {
      resp = await GameRepository.getGameResultTable(gameCode);
    }

    for (const r of resp) {
      let sessionTime = r.sessionTime;
      if (!sessionTime) {
        sessionTime = 0;
      }
      if (r.satAt) {
        const currentSessionTime = Math.round(
          (new Date().getTime() - r.satAt.getTime()) / 1000
        );
        // in seconds
        sessionTime = sessionTime + currentSessionTime;
      }
      r.sessionTime = sessionTime;
      r.sessionTimeStr = getSessionTimeStr(r.sessionTime);
    }

    return resp;
  } catch (err) {
    logger.error(
      `Error in getting game result table. gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(`Failed to get game result table. ${JSON.stringify(err)}`);
  }
}

export async function downloadResult(playerId: string, gameCode: string) {
  try {
    const game = await Cache.getGame(gameCode);
    let includeTips = false;
    if (game.clubCode) {
      const club = await Cache.getClub(game.clubCode);
      const owner: Player | undefined = await Promise.resolve(club.owner);
      if (owner) {
        if (owner.uuid === playerId) {
          includeTips = true;
        }
      }
    }
    const resp = await HistoryRepository.getGameResultTable(gameCode);
    const headers: Array<string> = ['name', 'id', 'hands', 'buyin', 'profit'];
    if (includeTips) {
      headers.push('tips');
    }
    const csvRows = new Array<string>();
    csvRows.push(headers.join(','));
    for (const row of resp) {
      const fields = new Array<string>();
      fields.push(row.playerName);
      fields.push(row.playerId);
      fields.push(row.handsPlayed);
      fields.push(row.buyIn);
      fields.push(row.profit);
      if (includeTips) {
        fields.push(row.rakePaid);
      }
      csvRows.push(fields.join(','));
    }
    const output = csvRows.join('\n');
    return output;
  } catch (err) {
    logger.error(
      `Error while downloading result. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(`Failed to get game result table. ${JSON.stringify(err)}`);
  }
}

export async function getGamePlayers(gameCode: string) {
  try {
    const resp = await GameRepository.getGamePlayers(gameCode);
    return resp;
  } catch (err) {
    logger.error(
      `Error while getting game players. gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed to get game players information. ${JSON.stringify(err)}`
    );
  }
}

function getSessionTimeStr(totalSeconds: number): string {
  if (totalSeconds < 60) {
    // "## seconds"
    return humanizeDuration(totalSeconds * 1000);
  }
  if (totalSeconds < 3600) {
    // "## minutes"
    return humanizeDuration(totalSeconds * 1000, {units: ['m'], round: true});
  }
  // "## hours"
  return humanizeDuration(totalSeconds * 1000, {units: ['h'], round: true});
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
      `Error while approving request. hostUuid: ${hostUuid}, playerUuid: ${playerUuid}, gameCode: ${gameCode}, type: ${type}, status: ${status}: ${errToLogString(
        err
      )}`
    );
    throw new Error(`Failed to approve buyin. ${JSON.stringify(err)}`);
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

    return gameState;
  } catch (err) {
    logger.error(
      `Error in myGameState. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(`Failed to get game state. ${JSON.stringify(err)}`);
  }
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
      tableGameState.push(gameState);
    });

    return tableGameState;
  } catch (err) {
    logger.error(
      `Error while getting table game state. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(`Failed to get game state. ${JSON.stringify(err)}`);
  }
}

export async function gameSettings(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const gameSettings = await GameSettingsRepository.get(gameCode);
    if (!gameSettings) {
      throw new Error(`Game ${gameCode} is not found`);
    }
    if (gameSettings.bombPotInterval) {
      gameSettings.bombPotInterval = Math.floor(
        gameSettings.bombPotInterval / 60
      );
    }
    if (gameSettings.waitlistSittingTimeout) {
      gameSettings.waitlistSittingTimeout = Math.floor(
        gameSettings.waitlistSittingTimeout / 60
      );
    }
    const roeGames = gameSettings.roeGames;
    const dealerChoiceGames = gameSettings.dealerChoiceGames;
    const gameSettingsRet = gameSettings as any;
    gameSettingsRet.roeGames = [];
    gameSettingsRet.dealerChoiceGames = [];
    if (roeGames) {
      gameSettingsRet.roeGames = roeGames.split(',');
    }
    if (dealerChoiceGames) {
      gameSettingsRet.dealerChoiceGames = dealerChoiceGames.split(',');
    }

    return gameSettingsRet;
  } catch (err) {
    logger.error(
      `Error while getting game settings. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(`Getting game settings failed`);
  }
}

export async function myGameSettings(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    // const gameSettings = await GameSettingsRepository.get(gameCode);
    // if (!gameSettings) {
    //   throw new Error(`Game ${gameCode} is not found`);
    // }
    // return gameSettings;
    return {
      autoStraddle: false,
      straddle: false,
      buttonStraddle: false,
      bombPotEnabled: false,
      muckLosingHand: false,
      runItTwiceEnabled: false,
    };
  } catch (err) {
    logger.error(
      `Error while getting game settings. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(`Getting game settings failed`);
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
    ret.gameID = game.id;
    ret.agoraAppId = getAgoraAppId();

    const updates = await GameUpdatesRepository.get(game.gameCode);
    const settings = await GameSettingsRepository.get(game.gameCode);
    if (updates && settings) {
      ret.useAgora = settings.useAgora;
      ret.audioConfEnabled = settings.audioConfEnabled;
      ret.rakeCollected = updates.rake;
      ret.handNum = updates.handNum;
      ret.janusRoomId = settings.janusRoomId;
      ret.janusRoomPin = settings.janusRoomPin;

      ret.bombPotEnabled = settings.bombPotEnabled;
      if (ret.bombPotEnabled) {
        ret.bombPotBet = settings.bombPotBet;
        ret.doubleBoardBombPot = settings.doubleBoardBombPot;
        ret.bombPotInterval = Math.floor(settings.bombPotInterval / 60);
        ret.bombPotIntervalInSecs = settings.bombPotInterval;
      }
      ret.ipCheck = settings.ipCheck;
      ret.gpsCheck = settings.gpsCheck;
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
    ret.pingChannel = Nats.getPingChannel(game.gameCode);
    ret.pongChannel = Nats.getPongChannel(game.gameCode);

    // player's role
    ret.isManager = isManager;
    ret.isHost = isHost;
    ret.isOwner = isOwner;

    // janus info
    ret.janusUrl = JanusSession.janusUrl();
    ret.janusSecret = JANUS_SECRET;
    ret.janusToken = JANUS_TOKEN;
    return ret;
  } catch (err) {
    logger.error(
      `Error while getting game info. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed to get game information. Message: ${
        err.message
      } err: ${JSON.stringify(err)}`
    );
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
      `Error while getting player role. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed to get game information. Message: ${
        err.message
      } err: ${JSON.stringify(err)}`
    );
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
    const status = await NextHandUpdatesRepository.leaveGame(player, game);
    return status;
  } catch (err) {
    logger.error(
      `Error while leaving game. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed to leave game. ${err.toString()} ${JSON.stringify(err)}`
    );
  }
}

export async function takeBreak(playerUuid: string, gameCode: string) {
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
    const takeBreak = new TakeBreak(game, player);
    const status = await takeBreak.takeBreak();
    return status;
  } catch (err) {
    logger.error(
      `Error while taking break. playerUuid: ${playerUuid}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(`Failed to take break. ${JSON.stringify(err)}`);
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
    let ip = '';
    let location: any = null;
    if (locationCheck != null) {
      ip = locationCheck.ip;
      location = locationCheck.location;
    }
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
      )}: ${errToLogString(err)}`
    );
    throw new Error(`Failed to sit back in the seat. ${JSON.stringify(err)}`);
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
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
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
    await PlayersInGameRepository.kickOutPlayer(gameCode, player);
    return true;
  } catch (err) {
    logger.error(
      `Error while kicking player out. requestUser: ${requestUser}, gameCode: ${gameCode}, kickedOutPlayer: ${kickedOutPlayer}: ${errToLogString(
        err
      )}`
    );
    throw new Error('Failed to kick out player');
  }
}

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

    const isAuthorized = await isHostOrManagerOrOwner(playerId, game);
    if (!isAuthorized) {
      logger.error(
        `Player: ${playerId} is not a owner or a manager ${game.clubName}. Cannot pause game`
      );
      throw new Error(
        `Player: ${playerId} is not a owner or a manager ${game.clubName}. Cannot pause game`
      );
    }

    if (
      game.status === GameStatus.ACTIVE &&
      game.tableStatus === TableStatus.GAME_RUNNING
    ) {
      // the game will be stopped in the next hand
      NextHandUpdatesRepository.pauseGameNextHand(game.id);
    } else {
      const status = await GameRepository.markGameStatus(
        game.id,
        GameStatus.PAUSED
      );
      return GameStatus[status];
    }
    return GameStatus[game.status];
  } catch (err) {
    logger.error(
      `Error while pausing game. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error('Failed to pause the game. ' + err.message);
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
      logger.info(`Resume game: ${gameCode}`);
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
      `Error while resuming game. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed to resume game:  ${err.message}. Game code: ${gameCode}`
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
      `Error while switching seat. playerUuid: ${playerUuid}, gameCode: ${gameCode}, seatNo: ${seatNo}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Player: ${playerUuid} Failed to join the game. ${JSON.stringify(err)}`
    );
  }
}

export async function approveBuyIn(
  playerId: string,
  gameCode: string,
  requestPlayerId: string
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const game = await Cache.getGame(gameCode);

    const isAuthorized = await isHostOrManagerOrOwner(playerId, game);
    if (!isAuthorized) {
      logger.error(
        `Player: ${playerId} is not a owner or a manager ${game.clubName}. Cannot approve/deny requests`
      );
      throw new Error(
        `Player: ${playerId} is not a owner or a manager ${game.clubName}. Cannot approve/deny requests`
      );
    }

    const player = await Cache.getPlayer(playerId);
  } catch (err) {
    logger.error(
      `Error while approving buy-in. playerId: ${playerId}, gameCode: ${gameCode}, requestPlayerId: ${requestPlayerId}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed to resume game:  ${err.message}. Game code: ${gameCode}`
    );
  }
}

export async function denyBuyIn(
  playerId: string,
  gameCode: string,
  requestPlayerId: string
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const game = await Cache.getGame(gameCode);

    const isAuthorized = await isHostOrManagerOrOwner(playerId, game);
    if (!isAuthorized) {
      logger.error(
        `Player: ${playerId} is not a owner or a manager ${game.clubName}. Cannot approve/deny requests`
      );
      throw new Error(
        `Player: ${playerId} is not a owner or a manager ${game.clubName}. Cannot approve/deny requests`
      );
    }
  } catch (err) {
    logger.error(
      `Error while denying buy-in. playerId: ${playerId}, gameCode: ${gameCode}, requestPlayerId: ${requestPlayerId}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed to resume game:  ${err.message}. Game code: ${gameCode}`
    );
  }
}

export async function dealerChoice(
  playerId: string,
  gameCode: string,
  gameTypeStr: string
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    const gameType: GameType = GameType[gameTypeStr];
    const game = await Cache.getGame(gameCode);
    const player = await Cache.getPlayer(playerId);
    await GameRepository.updateDealerChoice(game, player, gameType);
  } catch (err) {
    logger.error(
      `Error while updating dealer choice. playerId: ${playerId}, gameCode: ${gameCode}, gameTypeStr: ${gameTypeStr}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed to update set dealer choice:  ${err.message}. Game code: ${gameCode}`
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
    const player = await Cache.getPlayer(playerId);
    await GameRepository.postBlind(game, player);
    return true;
  } catch (err) {
    logger.error(
      `Error while posting blind. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed to post blind:  ${err.message}. Game code: ${gameCode}`
    );
  }
}

export async function updateGameSettings(
  playerId: string,
  gameCode: string,
  settings: any
): Promise<boolean> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    const game = await Cache.getGame(gameCode);
    const isAuthorized = await isHostOrManagerOrOwner(playerId, game);
    if (!isAuthorized) {
      logger.error(
        `Player: ${playerId} is not a owner or a manager ${game.clubName}. Cannot end the game`
      );
      throw new Error(
        `Player: ${playerId} is not a own9er or a manager ${game.clubName}. Cannot end the game`
      );
    }

    // update game settings
    await GameSettingsRepository.update(game, gameCode, settings);
    return true;
  } catch (err) {
    logger.error(
      `Error while updating game settings. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed updating game settings:  ${err.message}. Game code: ${gameCode}`
    );
  }
}

export async function updateGamePlayerSettings(
  playerId: string,
  gameCode: string,
  settings: GamePlayerSettings
): Promise<boolean> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    const game = await Cache.getGame(gameCode);
    const player = await Cache.getPlayer(playerId);
    // update player game settings
    return PlayersInGameRepository.updatePlayerGameSettings(
      player,
      game,
      settings
    );
  } catch (err) {
    logger.error(
      `Error while updating player settings. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed while updating player settings:  ${err.message}. Game code: ${gameCode}`
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
    const playersInSeats = await PlayersInGameRepository.getPlayersInSeats(
      game.id
    );
    const takenSeats = playersInSeats.map(x => x.seatNo);
    const availableSeats: Array<number> = [];
    for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
      if (takenSeats.indexOf(seatNo) === -1) {
        availableSeats.push(seatNo);
      }
    }
    return availableSeats;
  } catch (err) {
    logger.error(
      `Error while getting open seats. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed to resume game:  ${err.message}. Game code: ${gameCode}`
    );
  }
}

export async function playerStackStat(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const player = await Cache.getPlayer(playerId);
    const game = await Cache.getGame(gameCode);
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
      `Error while getting player stack stat. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(
      `Failed to resume game:  ${err.message}. Game code: ${gameCode}`
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

    const playersInGame = await GameRepository.getPlayersInGameById(game.id);
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
      `Error while getting players in game data. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
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

    const playersGameTracker = await GameRepository.getPlayersGameTrackerById(
      game.id
    );
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
      `Error while getting players game tracker data. playerId: ${playerId}, gameCode: ${gameCode}: ${errToLogString(
        err
      )}`
    );
    throw new Error(`Failed to retreive players in game data - ${err}`);
  }
}

const resolvers: any = {
  Query: {
    gameById: async (parent, args, ctx, info) => {
      const game = await Cache.getGame(args.gameCode);
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
    waitingList: async (parent, args, ctx, info) => {
      return await waitingList(ctx.req.playerId, args.gameCode);
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
    completedGame: async (parent, args, ctx, info) => {
      return await completedGame(ctx.req.playerId, args.gameCode);
    },
    currentHandLog: async (parent, args, ctx, info) => {
      const game = await Cache.getGame(args.gameCode);
      logger.info(`Getting current hand log for ${args.gameCode}`);
      return getCurrentHandLog(game.id);
    },
    gameResultTable: async (parent, args, ctx, info) => {
      return await getGameResultTable(args.gameCode);
    },
    gamePlayers: async (parent, args, ctx, info) => {
      return await getGamePlayers(args.gameCode);
    },
    downloadResult: async (parent, args, ctx, info) => {
      return await downloadResult(ctx.req.playerId, args.gameCode);
    },
    openSeats: async (parent, args, ctx, info) => {
      return await openSeats(ctx.req.playerId, args.gameCode);
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
    gameSettings: async (parent, args, ctx, info) => {
      return await gameSettings(ctx.req.playerId, args.gameCode);
    },
    myGameSettings: async (parent, args, ctx, info) => {
      return await myGameSettings(ctx.req.playerId, args.gameCode);
    },
  },
  GameInfo: {
    settings: async (parent, args, ctx, info) => {
      const settings = await gameSettings(ctx.req.playerId, args.gameCode);
      return settings;
    },
    seatInfo: async (parent, args, ctx, info) => {
      const game = await Cache.getGame(parent.gameCode);
      const seatStatuses = await GameRepository.getSeatStatus(game.id);
      const players = await PlayersInGameRepository.getPlayersInSeats(game.id);
      const playersInSeats = new Array<any>();
      for (const player of players) {
        const playerInSeat = player as any;
        playerInSeat.status = PlayerStatus[player.status];
        playerInSeat.name = player.playerName;
        playerInSeat.buyInExpTime = player.buyInExpAt;
        playerInSeat.breakExpTime = player.breakTimeExpAt;
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
      return {
        playersInSeats: playersInSeats,
        availableSeats: availableSeats,
        seats: seats,
      };
    },
    gameToken: async (parent, args, ctx, info) => {
      const game = await Cache.getGame(parent.gameCode);
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
    playerGameStatus: async (parent, args, ctx, info) => {
      const game = await Cache.getGame(parent.gameCode);
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
        return PlayerStatus[playerState.playerStatus];
      }
      return PlayerStatus[PlayerStatus.NOT_PLAYING];
    },
    allPlayers: async (parent, args, ctx, info) => {
      const allPlayersInGame = GameRepository.getAllPlayersInGame(
        parent.gameCode
      );
      return allPlayersInGame;
    },
  },
  CompletedGame: {
    stackStat: async (parent, args, ctx, info) => {
      if (parent.handStack) {
        const stack = JSON.parse(parent.handStack);
        return stack.map(x => {
          return {
            handNum: x.hand,
            before: x.playerStack.b,
            after: x.playerStack.a,
          };
        });
      } else {
        return [];
      }
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
        ip: '',
        location: args.location,
      });
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
    buyIn: async (parent, args, ctx, info) => {
      const status = await buyIn(ctx.req.playerId, args.gameCode, args.amount);
      return status;
    },
    reload: async (parent, args, ctx, info) => {
      return reload(ctx.req.playerId, args.gameCode, args.amount);
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
    switchSeat: async (parent, args, ctx, info) => {
      return switchSeat(ctx.req.playerId, args.gameCode, args.seatNo);
    },
    dealerChoice: async (parent, args, ctx, info) => {
      return dealerChoice(ctx.req.playerId, args.gameCode, args.gameType);
    },
    postBlind: async (parent, args, ctx, info) => {
      return postBlind(ctx.req.playerId, args.gameCode);
    },
    updateGameSettings: async (parent, args, ctx, info) => {
      return updateGameSettings(ctx.req.playerId, args.gameCode, args.settings);
    },
    updateGamePlayerSettings: async (parent, args, ctx, info) => {
      return updateGamePlayerSettings(
        ctx.req.playerId,
        args.gameCode,
        args.settings as GamePlayerSettings
      );
    },
  },
};

export function getResolvers() {
  return resolvers;
}
