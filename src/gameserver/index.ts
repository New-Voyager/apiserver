import axios from 'axios';
import {getLogger} from '@src/utils/log';
import {PokerGame} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {PlayerGameTracker} from '@src/entity/chipstrack';
import {GameStatus} from '@src/entity/types';
import {GameRepository} from '@src/repositories/game';

let notifyGameServer = false;
const logger = getLogger('gameServer');
const gameServerUrl = 'http://localhost:8080';

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

export async function publishNewGame(game: any) {
  if (!notifyGameServer) {
    return;
  }
  const gameType = game.gameType;
  // get game server of this game
  const gameServerUrl = await getGameServerUrl(game.id);

  const message = {
    type: 'NewGame',
    clubId: game.club.id,
    gameId: game.id,
    clubCode: game.club.clubCode,
    gameCode: game.gameCode,
    gameType: gameType,
    title: game.title,
    smallBlind: game.smallBlind,
    bigBlind: game.bigBlind,
    straddleBet: game.straddleBet,
    utgStraddleBetAllowed: game.utgStraddleBetAllowed,
    minPlayers: game.minPlayers,
    maxPlayers: game.maxPlayers,
    gameLength: game.gameLength,
    rakePercentage: game.rakePercentage,
    rakeCap: game.rakeCap,
    buyInMin: game.buyInMin,
    buyInMax: game.buyInMax,
    actionTime: game.actionTime,
    privateGame: game.privateRoom,
    startedBy: game.startedBy.name,
    startedByUuid: game.startedBy.uuid,
    breakLength: game.breakLength,
    autoKickAfterBreak: game.autoKickAfterBreak,
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
  };
  const newGameUrl = `${gameServerUrl}/player-update`;
  const resp = await axios.post(newGameUrl, message);
  if (resp.status !== 200) {
    logger.error(`Failed to update plater status: ${newGameUrl}`);
    throw new Error(`Failed to update plater status: ${newGameUrl}`);
  }
}

export async function changeGameStatus(game: PokerGame, status: GameStatus) {
  if (!notifyGameServer) {
    return;
  }
  const gameServerUrl = await getGameServerUrl(game.id);

  const message = {
    type: 'GameStatus',
    gameId: game.id,
    gameStatus: status,
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
  return gameServerUrl;
  //return gameServer.url;
}
