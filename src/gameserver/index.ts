import axios from 'axios';
import {getLogger} from '@src/utils/log';
import {PokerGame} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {GameStatus, PlayerStatus, TableStatus} from '@src/entity/types';
import {GameRepository} from '@src/repositories/game';
import {NewUpdate} from '@src/repositories/types';
import * as Constants from '../const';

export let notifyGameServer = false;
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

async function getGameServerUrl(gameId: number): Promise<string> {
  // get game server of this game
  const gameServer = await GameRepository.getGameServer(gameId);
  if (!gameServer) {
    return '';
  }
  return gameServer.url;
}

export async function publishNewGame(game: any, gameServer: any) {
  if (!notifyGameServer) {
    return;
  }
  const gameType = game.gameType;
  // get game server of this game
  const gameServerUrl = gameServer.url;

  const message = {
    gameId: game.id,
    gameCode: game.gameCode,
  };

  const url = `${gameServerUrl}/new-game`;
  logger.info(
    `Game server: ${gameServer.url} is requested host ${game.gameCode}`
  );
  try {
    const resp = await axios.post(url, message);
    if (resp?.status !== 200) {
      throw new Error(`Received HTTP ${resp?.status}`);
    }
    return resp.data.tableStatus;
  } catch (err) {
    const msg = `Error while posting new game to ${url}: ${err.message}`;
    logger.error(msg);
    throw new Error(msg);
  }
}

// export async function pendingProcessDone(
//   gameId: number,
//   gameStatus: GameStatus,
//   tableStatus: TableStatus
// ) {
//   if (!notifyGameServer) {
//     return;
//   }
//   const gameServerUrl = await getGameServerUrl(gameId);
//   const url = `${gameServerUrl}/pending-updates?game-id=${gameId}&done=1&status=${gameStatus}&table-status=${tableStatus}`;
//   try {
//     const resp = await axios.post(url);
//     if (resp.status !== 200) {
//       logger.error(`Failed to update pending updates: ${url}`);
//       throw new Error(`Failed to update pending updates: ${url}`);
//     }
//   } catch (err) {
//     logger.error(`Failed to update pending updates for game: ${gameId}.`);
//   }
// }

export async function resumeGame(gameId: number) {
  if (!notifyGameServer) {
    return;
  }
  const gameServerUrl = await getGameServerUrl(gameId);
  const url = `${gameServerUrl}/resume-game?game-id=${gameId}`;
  try {
    const resp = await axios.post(url);
    if (resp.status !== 200) {
      logger.error(`Failed to update pending updates: ${url}`);
      throw new Error(`Failed to update pending updates: ${url}`);
    }
  } catch (err) {
    logger.error(`Failed to update pending updates for game: ${gameId}.`);
  }
}

export async function playerStatusChanged(
  game: PokerGame,
  player: any,
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

  const url = `${gameServerUrl}/player-update`;
  try {
    const resp = await axios.post(url, message);
    if (resp?.status !== 200) {
      throw new Error(`Received HTTP ${resp?.status}`);
    }
  } catch (err) {
    const msg = `Error while posting player update to ${url}: ${err.message}`;
    logger.error(msg);
  }
}

export async function getCurrentHandLog(gameId: number): Promise<any> {
  if (!notifyGameServer) {
    return;
  }
  const gameServerUrl = await getGameServerUrl(gameId);
  const url = `${gameServerUrl}/current-hand-log?game-id=${gameId}`;
  try {
    const resp = await axios.get(url);
    if (resp?.status !== 200) {
      throw new Error(`Received HTTP ${resp?.status}`);
    }
    return resp.data;
  } catch (err) {
    const msg = `Failed to get current hand log from ${url}: ${err.message}`;
    logger.error(msg);
    throw new Error(msg);
  }
}

// export async function openSeat(
//   game: PokerGame,
//   seatNo: number,
//   timeRemaining: number
// ) {
//   if (!notifyGameServer) {
//     return;
//   }

//   const gameServerUrl = await getGameServerUrl(game.id);
//   const message = {
//     type: Constants.TableUpdateOpenSeat,
//     gameId: game.id,
//     seatNo: seatNo,
//   };

//   const url = `${gameServerUrl}/table-update`;
//   try {
//     const resp = await axios.post(url, message);
//     if (resp?.status !== 200) {
//       throw new Error(`Received HTTP ${resp?.status}`);
//     }
//   } catch (err) {
//     const msg = `Error while posting table update to ${url}: ${err.message}`;
//     logger.error(msg);
//     throw new Error(msg);
//   }
// }

// export async function waitlistSeating(
//   game: PokerGame,
//   player: Player,
//   timeRemaining: number
// ) {
//   if (!notifyGameServer) {
//     return;
//   }

//   const gameServerUrl = await getGameServerUrl(game.id);
//   const message = {
//     type: Constants.TableWaitlistSeating,
//     gameId: game.id,
//     waitlistPlayerId: player.id,
//     waitlistPlayerName: player.name,
//     waitlisttPlayerUuid: player.uuid,
//     waitlistRemainingTime: timeRemaining,
//   };

//   const url = `${gameServerUrl}/table-update`;
//   try {
//     const resp = await axios.post(url, message);
//     if (resp?.status !== 200) {
//       throw new Error(`Received HTTP ${resp?.status}`);
//     }
//   } catch (err) {
//     const msg = `Error while posting table update to ${url}: ${err.message}`;
//     logger.error(msg);
//     throw new Error(msg);
//   }
// }

export async function playerConfigUpdate(game: PokerGame, update: any) {
  if (!notifyGameServer) {
    return;
  }

  const gameServerUrl = await getGameServerUrl(game.id);

  const url = `${gameServerUrl}/player-config-update`;

  try {
    const resp = await axios.post(url, update);
    if (resp?.status !== 200) {
      throw new Error(`Received HTTP ${resp?.status}`);
    }
  } catch (err) {
    const msg = `Error while posting player config status to ${url}: ${err.message}`;
    logger.error(msg);
    throw new Error(msg);
  }
}
