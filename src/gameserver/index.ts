import axios from 'axios';
import {getLogger} from '@src/utils/log';
import {PokerGame} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {PlayerGameTracker} from '@src/entity/chipstrack';
import {GameStatus, PlayerStatus, TableStatus} from '@src/entity/types';
import {GameRepository} from '@src/repositories/game';
import {NewUpdate} from '@src/repositories/types';
import * as Constants from '../const';
import {SeatMove, SeatUpdate} from '@src/types';
import {NetworkStatus} from 'apollo-client';

let notifyGameServer = false;
const logger = getLogger('gameServer');

export function initializeGameServer() {
  if (process.env.NOTIFY_GAME_SERVER === '1') {
    notifyGameServer = true;
  }
  if (notifyGameServer) {
    logger.info('Notification to game server is enabled');
  } else {
    logger.info('Notification to game server is disabled');
  }
}

export function isGameServerEnabled() {
  return notifyGameServer;
}

export async function publishNewGame(game: any, gameServer: any) {
  if (!notifyGameServer) {
    return;
  }
  const gameType = game.gameType;
  // get game server of this game
  const gameServerUrl = gameServer.url;

  const message = {
    clubId: game.club.id,
    gameId: game.id,
    clubCode: game.club.clubCode,
    gameCode: game.gameCode,
  };

  const newGameUrl = `${gameServerUrl}/new-game`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to create a new game at: ${newGameUrl}`);
    throw new Error(`Failed to create a new game at: ${newGameUrl}`);
  }

  return resp.data.tableStatus;
}

export async function newPlayerSat(
  game: PokerGame,
  player: Player,
  seatNo: number,
  playerGameInfo: PlayerGameTracker
) {
  if (!notifyGameServer) {
    return;
  }

  const gameServerUrl = await getGameServerUrl(game.id);

  const message = {
    type: 'PlayerUpdate',
    gameId: game.id,
    playerId: player.id,
    playerUuid: player.uuid,
    name: player.name,
    seatNo: seatNo,
    stack: playerGameInfo.stack,
    status: playerGameInfo.status,
    buyIn: playerGameInfo.buyIn,
    gameToken: playerGameInfo.gameToken,
    newUpdate: NewUpdate.NEW_PLAYER,
  };

  const newGameUrl = `${gameServerUrl}/player-update`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to update plater status: ${newGameUrl}`);
    throw new Error(`Failed to update plater status: ${newGameUrl}`);
  }
}

export async function playerBuyIn(
  game: PokerGame,
  player: Player,
  playerGameInfo: PlayerGameTracker
) {
  if (!notifyGameServer) {
    return;
  }

  const gameServerUrl = await getGameServerUrl(game.id);

  const message = {
    type: 'PlayerUpdate',
    gameId: game.id,
    playerId: player.id,
    playerUuid: player.uuid,
    name: player.name,
    seatNo: playerGameInfo.seatNo,
    stack: playerGameInfo.stack,
    status: playerGameInfo.status,
    buyIn: playerGameInfo.buyIn,
    newUpdate: NewUpdate.NEW_BUYIN,
  };
  const newGameUrl = `${gameServerUrl}/player-update`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to update plater status: ${newGameUrl}`);
    throw new Error(`Failed to update plater status: ${newGameUrl}`);
  }
}

export async function changeGameStatus(
  game: PokerGame,
  status: GameStatus,
  tableStatus: TableStatus
) {
  if (!notifyGameServer) {
    return;
  }
  const gameServerUrl = await getGameServerUrl(game.id);

  const message = {
    type: 'GameStatus',
    gameId: game.id,
    gameStatus: status,
    tableStatus: tableStatus,
  };
  const newGameUrl = `${gameServerUrl}/game-update-status`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to update game status: ${newGameUrl}`);
    throw new Error(`Failed to update game status: ${newGameUrl}`);
  }
}

async function getGameServerUrl(gameId: number): Promise<string> {
  // get game server of this game
  const gameServer = await GameRepository.getGameServer(gameId);
  if (!gameServer) {
    return '';
  }
  return gameServer.url;
}

export async function playerKickedOut(
  game: PokerGame,
  player: Player,
  seatNo: number
) {
  if (!notifyGameServer) {
    return;
  }

  const gameServerUrl = await getGameServerUrl(game.id);

  const message = {
    type: 'PlayerUpdate',
    gameId: game.id,
    playerId: player.id,
    playerUuid: player.uuid,
    name: player.name,
    seatNo: seatNo,
    status: PlayerStatus.KICKED_OUT,
    newUpdate: NewUpdate.LEFT_THE_GAME,
  };

  const newGameUrl = `${gameServerUrl}/player-update`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to update player status: ${newGameUrl}`);
    throw new Error(`Failed to update player status: ${newGameUrl}`);
  }
}

export async function pendingProcessDone(gameId: number) {
  if (!notifyGameServer) {
    return;
  }
  const gameServerUrl = await getGameServerUrl(gameId);
  const newGameUrl = `${gameServerUrl}/pending-updates?game-id=${gameId}&done=1`;
  const resp = await axios.post(newGameUrl);
  if (resp.status !== 200) {
    logger.error(`Failed to update pending updates: ${newGameUrl}`);
    throw new Error(`Failed to update pending updates: ${newGameUrl}`);
  }
}

export async function playerStatusChanged(
  game: PokerGame,
  player: Player,
  oldStatus: PlayerStatus,
  newStatus: NewUpdate,
  stack: number,
  seatNo: number
) {
  if (!notifyGameServer) {
    return;
  }

  const gameServerUrl = await getGameServerUrl(game.id);

  const message = {
    type: 'PlayerUpdate',
    gameId: game.id,
    playerId: player.id,
    playerUuid: player.uuid,
    name: player.name,
    seatNo: seatNo,
    stack: stack,
    status: oldStatus,
    newUpdate: newStatus,
  };

  const newGameUrl = `${gameServerUrl}/player-update`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to update player status: ${newGameUrl}`);
    throw new Error(`Failed to update player status: ${newGameUrl}`);
  }
}

export async function startTimer(
  gameId: number,
  playerId: number,
  purpose: string,
  expAt: Date
) {
  if (!notifyGameServer) {
    return;
  }

  // time in seconds
  const expSeconds = Math.round(expAt.getTime() / 1000);
  const gameServerUrl = await getGameServerUrl(gameId);
  const newGameUrl = `${gameServerUrl}/start-timer?game-id=${gameId}&player-id=${playerId}&purpose=${purpose}&timeout-at=${expSeconds}`;
  const resp = await axios.post(newGameUrl);
  if (resp.status !== 200) {
    logger.error(`Failed to start a timer: ${newGameUrl}`);
    throw new Error(`Failed to start a timer: ${newGameUrl}`);
  }
}

export async function cancelTimer(
  gameId: number,
  playerId: number,
  purpose: string
) {
  if (!notifyGameServer) {
    return;
  }

  // time in seconds
  const gameServerUrl = await getGameServerUrl(gameId);
  const newGameUrl = `${gameServerUrl}/cancel-timer?game-id=${gameId}&player-id=${playerId}&purpose=${purpose}`;
  const resp = await axios.post(newGameUrl);
  if (resp.status !== 200) {
    logger.error(`Failed to cancel a timer: ${newGameUrl}`);
    throw new Error(`Failed to cancel a timer: ${newGameUrl}`);
  }
}

export async function playerSwitchSeat(
  game: PokerGame,
  player: Player,
  playerGameInfo: PlayerGameTracker,
  oldSeatNo: number
) {
  if (!notifyGameServer) {
    return;
  }

  const gameServerUrl = await getGameServerUrl(game.id);

  const message = {
    type: 'PlayerUpdate',
    gameId: game.id,
    playerId: player.id,
    playerUuid: player.uuid,
    name: player.name,
    oldSeatNo: oldSeatNo,
    seatNo: playerGameInfo.seatNo,
    stack: playerGameInfo.stack,
    status: playerGameInfo.status,
    buyIn: playerGameInfo.buyIn,
    newUpdate: NewUpdate.SWITCH_SEAT,
  };
  const newGameUrl = `${gameServerUrl}/player-update`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to update plater status: ${newGameUrl}`);
    throw new Error(`Failed to update plater status: ${newGameUrl}`);
  }
}

export async function playerLeftGame(
  game: PokerGame,
  player: Player,
  seatNo: number
) {
  if (!notifyGameServer) {
    return;
  }

  const gameServerUrl = await getGameServerUrl(game.id);

  const message = {
    type: 'PlayerUpdate',
    gameId: game.id,
    playerId: player.id,
    playerUuid: player.uuid,
    name: player.name,
    seatNo: seatNo,
    status: PlayerStatus.LEFT,
    newUpdate: NewUpdate.LEFT_THE_GAME,
  };

  const newGameUrl = `${gameServerUrl}/player-update`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to update player status: ${newGameUrl}`);
    throw new Error(`Failed to update player status: ${newGameUrl}`);
  }
}

export async function getCurrentHandLog(gameId: number): Promise<any> {
  if (!notifyGameServer) {
    return;
  }
  const gameServerUrl = await getGameServerUrl(gameId);
  const newGameUrl = `${gameServerUrl}/current-hand-log?game-id=${gameId}`;
  const resp = await axios.get(newGameUrl);
  if (resp.status !== 200) {
    logger.error(`Failed to update pending updates: ${newGameUrl}`);
    throw new Error(`Failed to update pending updates: ${newGameUrl}`);
  }
  return resp.data;
}

export async function openSeat(
  game: PokerGame,
  seatNo: number,
  timeRemaining: number
) {
  if (!notifyGameServer) {
    return;
  }

  const gameServerUrl = await getGameServerUrl(game.id);
  const message = {
    type: Constants.TableUpdateOpenSeat,
    gameId: game.id,
    seatNo: seatNo,
  };

  const newGameUrl = `${gameServerUrl}/table-update`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to update table status: ${newGameUrl}`);
    throw new Error(`Failed to update table status: ${newGameUrl}`);
  }
}

export async function waitlistSeating(
  game: PokerGame,
  player: Player,
  timeRemaining: number
) {
  if (!notifyGameServer) {
    return;
  }

  const gameServerUrl = await getGameServerUrl(game.id);
  const message = {
    type: Constants.TableWaitlistSeating,
    gameId: game.id,
    waitlistPlayerId: player.id,
    waitlistPlayerName: player.name,
    waitlisttPlayerUuid: player.uuid,
    waitlistRemainingTime: timeRemaining,
  };

  const newGameUrl = `${gameServerUrl}/table-update`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to update table status: ${newGameUrl}`);
    throw new Error(`Failed to update table status: ${newGameUrl}`);
  }
}

export async function initiateSeatChangeProcess(
  game: PokerGame,
  seatNo: number,
  timeRemaining: number,
  seatChangePlayers: Array<number>,
  seatChangeSeatNos: Array<number>
) {
  if (!notifyGameServer) {
    return;
  }

  const gameServerUrl = await getGameServerUrl(game.id);
  const message = {
    type: Constants.TableSeatChangeProcess,
    gameId: game.id,
    seatNo: seatNo,
    seatChangeRemainingTime: timeRemaining,
    seatChangePlayers: seatChangePlayers,
    seatChangeSeatNos: seatChangeSeatNos,
  };

  const newGameUrl = `${gameServerUrl}/table-update`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to update table status: ${newGameUrl}`);
    throw new Error(`Failed to update table status: ${newGameUrl}`);
  }
}

// indicate the players that host has started to make seat change
export async function hostSeatChangeProcessStarted(
  game: PokerGame,
  seatChangeHostId: number
) {
  if (!notifyGameServer) {
    return;
  }

  const gameServerUrl = await getGameServerUrl(game.id);
  const message = {
    type: Constants.TableHostSeatChangeProcessStart,
    gameId: game.id,
    seatChangeHostId: seatChangeHostId,
  };

  const newGameUrl = `${gameServerUrl}/table-update`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to update table status: ${newGameUrl}`);
    throw new Error(`Failed to update table status: ${newGameUrl}`);
  }
}

// indicate the players that host has ended the seat change
export async function hostSeatChangeProcessEnded(
  game: PokerGame,
  seatUpdates: Array<SeatUpdate>,
  seatChangeHostId: number
) {
  if (!notifyGameServer) {
    return;
  }

  const gameServerUrl = await getGameServerUrl(game.id);
  const message = {
    type: Constants.TableHostSeatChangeProcessEnd,
    gameId: game.id,
    seatUpdates: seatUpdates,
    seatChangeHostId: seatChangeHostId,
  };

  const newGameUrl = `${gameServerUrl}/table-update`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to update table status: ${newGameUrl}`);
    throw new Error(`Failed to update table status: ${newGameUrl}`);
  }
}

// indicate the players that host has ended the seat change
export async function hostSeatChangeSeatMove(
  game: PokerGame,
  updates: Array<SeatMove>
) {
  if (!notifyGameServer) {
    return;
  }

  const gameServerUrl = await getGameServerUrl(game.id);
  const message = {
    type: Constants.TableHostSeatChangeMove,
    gameId: game.id,
    seatMoves: updates,
  };

  const newGameUrl = `${gameServerUrl}/table-update`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to update table status: ${newGameUrl}`);
    throw new Error(`Failed to update table status: ${newGameUrl}`);
  }
}

export async function playerConfigUpdate(game: PokerGame, update: any) {
  if (!notifyGameServer) {
    return;
  }

  const gameServerUrl = await getGameServerUrl(game.id);

  const newGameUrl = `${gameServerUrl}/player-config-update`;
  const resp = await axios.post(newGameUrl, update);
  if (resp.status !== 200) {
    logger.error(`Failed to update player config status: ${newGameUrl}`);
    throw new Error(`Failed to update player config status: ${newGameUrl}`);
  }
}
