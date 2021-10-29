import axios from 'axios';
import {errToStr, getLogger} from '@src/utils/log';
import {PokerGame} from '@src/entity/game/game';
import {GameRepository} from '@src/repositories/game';
import {EntityManager} from 'typeorm';

export let notifyGameServer = false;
const logger = getLogger('gameserver');

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

async function getGameServerUrl(
  gameId: number,
  transactionManager?: EntityManager
): Promise<string> {
  // get game server of this game
  const gameServer = await GameRepository.getGameServer(
    gameId,
    transactionManager
  );
  if (!gameServer) {
    return '';
  }
  return gameServer.url;
}

export async function publishNewGame(
  game: any,
  gameServer: any,
  isRestart: boolean
) {
  if (!notifyGameServer) {
    return;
  }
  const gameType = game.gameType;
  // get game server of this game
  const gameServerUrl = gameServer.url;

  const message = {
    gameId: game.id,
    gameCode: game.gameCode,
    isRestart: isRestart,
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
    const msg = `Error while posting new game to ${url}: ${errToStr(err)}`;
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

export async function resumeGame(
  gameId: number,
  transactionManager?: EntityManager
) {
  logger.info(`Starting resumeGame game: ${gameId}`);
  if (!notifyGameServer) {
    return;
  }
  const gameServerUrl = await getGameServerUrl(gameId, transactionManager);
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
  logger.info(`Finished resumeGame game: ${gameId}`);
}

export async function endGame(gameId: number) {
  if (!notifyGameServer) {
    return;
  }
  const gameServerUrl = await getGameServerUrl(gameId);
  const url = `${gameServerUrl}/end-game?game-id=${gameId}`;
  try {
    const resp = await axios.post(url);
    if (resp.status !== 200) {
      const msg = `Could not post to URL: ${url}`;
      logger.error(msg);
      throw new Error(msg);
    }
  } catch (err) {
    logger.error(`Failed to end game: ${gameId}.`);
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
    const msg = `Failed to get current hand log from ${url}: ${errToStr(err)}`;
    logger.error(msg);
    throw new Error(msg);
  }
}

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
    const msg = `Error while posting player config status to ${url}: ${errToStr(
      err
    )}`;
    logger.error(msg);
    throw new Error(msg);
  }
}
