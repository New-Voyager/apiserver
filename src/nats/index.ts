import * as nats from 'nats';
import {getLogger} from '@src/utils/log';
import {PokerGame} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {PlayerGameTracker} from '@src/entity/chipstrack';
import {GameStatus} from '@src/entity/types';
import {GameRepository} from '@src/repositories/game';

let natsEnabled = false;
let natsServer = 'nats://localhost:4222';
let nc: nats.Client;
//natsEnabled = false;
const logger = getLogger('nats');
const APISERVER_TO_GAMESERVER = 'apiserver.gameserver';

export function initializeNats() {
  if (process.env.NATS_SERVER) {
    natsServer = process.env.NATS_SERVER;
  }

  if (process.env.NATS_ENABLED === '1') {
    natsEnabled = true;
  }

  if (natsEnabled) {
    try {
      logger.info(`Connecting to nats server: ${natsServer}`);
      const opts: nats.ClientOpts = {
        json: true,
      };
      nc = nats.connect(natsServer, opts);
      logger.info(`Connecting to nats server: ${natsServer} succeeded`);
    } catch (err) {
      logger.info(
        `Connecting to nats server: ${natsServer} failed. Error: ${err.toString()}`
      );
    }
  }
}

export async function publishNewGame(game: any) {
  if (!natsEnabled) {
    return;
  }
  const gameType = game.gameType;
  // get game server of this game
  const gameServerNo = await getGameServerNumber(game.id);

  const message = {
    type: 'NewGame',
    gameServer: gameServerNo,
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

  nc.publish(APISERVER_TO_GAMESERVER, message);
}

export async function newPlayerSat(
  game: PokerGame,
  player: Player,
  seatNo: number,
  playerGameInfo: PlayerGameTracker
) {
  if (!natsEnabled) {
    return;
  }

  // get game server of this game
  const gameServerNo = await getGameServerNumber(game.id);

  const message = {
    type: 'PlayerUpdate',
    gameServer: gameServerNo,
    gameId: game.id,
    playerId: player.id,
    playerUuid: player.uuid,
    name: player.name,
    seatNo: seatNo,
    stack: playerGameInfo.stack,
    status: playerGameInfo.status,
    buyIn: playerGameInfo.buyIn,
  };
  nc.publish(APISERVER_TO_GAMESERVER, message);
}

export async function playerBuyIn(
  game: PokerGame,
  player: Player,
  playerGameInfo: PlayerGameTracker
) {
  if (!natsEnabled) {
    return;
  }

  // get game server of this game
  const gameServerNo = await getGameServerNumber(game.id);

  const message = {
    type: 'PlayerUpdate',
    gameServer: gameServerNo,
    gameId: game.id,
    playerId: player.id,
    playerUuid: player.uuid,
    name: player.name,
    seatNo: playerGameInfo.seatNo,
    stack: playerGameInfo.stack,
    status: playerGameInfo.status,
    buyIn: playerGameInfo.buyIn,
  };
  nc.publish(APISERVER_TO_GAMESERVER, message);
}

export async function changeGameStatus(game: PokerGame, status: GameStatus) {
  if (!natsEnabled) {
    return;
  }
  // get game server of this game
  const gameServerNo = await getGameServerNumber(game.id);

  const message = {
    type: 'GameStatus',
    gameServer: gameServerNo,
    gameId: game.id,
    gameStatus: status,
  };
  nc.publish(APISERVER_TO_GAMESERVER, message);
}

async function getGameServerNumber(gameId: number): Promise<number> {
  // get game server of this game
  const gameServer = await GameRepository.getGameServer(gameId);
  if (!gameServer) {
    return 0;
  }
  return gameServer.serverNumber;
}
