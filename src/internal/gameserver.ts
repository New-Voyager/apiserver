import {In} from 'typeorm';
import {GameServer} from '@src/entity/game/gameserver';
import {GameServerStatus, GameStatus} from '@src/entity/types';
import {GameRepository} from '@src/repositories/game';
import {fixQuery} from '@src/utils';
import {errToLogString, getLogger} from '@src/utils/log';
import {PokerGame} from '@src/entity/game/game';
import {publishNewGame} from '@src/gameserver';
import {getGameConnection, getGameRepository} from '@src/repositories';
import {Cache} from '@src/cache/index';
import {GameServerRepository} from '@src/repositories/gameserver';
const logger = getLogger('internal::gameserver');

class GameServerAPIs {
  /**
   * {
   *  "ip_address": "ip",
   *  "current_memory": 100000,
   *  "status": "ACTIVE"
   * }
   * @param req request object
   * @param resp response object
   */
  public async registerGameServer(req: any, resp: any) {
    const registerPayload = req.body;
    const errors = new Array<string>();
    try {
      if (!registerPayload.ipAddress) {
        errors.push('ipAddress is missing');
      }
      if (!registerPayload.currentMemory) {
        errors.push('currentMemory field is missing');
      }
      if (!registerPayload.url) {
        errors.push('url field is missing');
      }

      if (
        process.env.DEBUG_WITH_STACK &&
        process.env.DEBUG_WITH_STACK === '1'
      ) {
        registerPayload.url = `http://localhost:8080`;
      }

      if (!registerPayload.status) {
        errors.push('status is missing');
      } else {
        if (
          registerPayload.status !==
            GameServerStatus[GameServerStatus.ACTIVE] &&
          registerPayload.status !== GameServerStatus[GameServerStatus.DOWN]
        ) {
          errors.push('invalid status field');
        }
      }
    } catch (err) {
      resp.status(500).send('Internal service error');
      return;
    }

    if (errors.length) {
      resp.status(500).send(JSON.stringify(errors));
      return;
    }
    const [response, error] = await createGameServer(registerPayload);
    if (error === null) {
      resp.status(200).send(JSON.stringify(response));
    } else {
      resp.status(500).send(JSON.stringify(error));
    }
  }

  /**
   * Updates existing game server
   * {
   *  status: "",
   *  memory: "",
   *  no_games_handled: ""
   *  no_active_games:
   *  no_active_players:
   *  no_players_handled:
   * }
   * @param req
   * @param resp
   */
  public async updateGameServer(req: any, resp: any) {
    const registerPayload = req.body;
    const response = await editGameServer(registerPayload);
    if (response === true) {
      resp.status(200).send(JSON.stringify({status: 'OK'}));
    } else {
      resp.status(500).send(JSON.stringify(response));
    }
  }

  public async getGameServers(req: any, resp: any) {
    const response = await getAllGameServers();
    resp.status(200).send(JSON.stringify({servers: response}));
  }

  public async getSpecificGameServer(req: any, resp: any) {
    const gameCode = req.params.gameCode;
    const errors = new Array<string>();
    try {
      if (!gameCode) {
        errors.push('gameCode is missing');
      }
    } catch (err) {
      resp.status(500).send('Internal service error');
      return;
    }

    if (errors.length) {
      resp.status(500).send(JSON.stringify(errors));
      return;
    }
    try {
      const game = await Cache.getGame(gameCode);
      if (!game) {
        throw new Error(`Game: ${gameCode} is not found`);
      }
      const gameServer = await Cache.getGameServer(game.gameServerUrl);
      if (!gameServer) {
        throw new Error(`Game server is not found: ${gameCode}`);
      }
      resp.status(200).send(JSON.stringify({server: gameServer}));
    } catch (err) {
      logger.error(err.message);
      resp.status(500).send(JSON.stringify({error: err.message}));
    }
  }

  public async restartGames(req: any, resp: any) {
    const payload = req.body;
    let url: string;
    if (process.env.DEBUG_WITH_STACK && process.env.DEBUG_WITH_STACK === '1') {
      url = `http://localhost:8080`;
    } else {
      url = payload.url;
    }
    let gameServer: GameServer | null;
    try {
      gameServer = await GameServerRepository.get(url);
      if (!gameServer) {
        throw new Error(`Cannot find game server with url: ${url}`);
      }
    } catch (err) {
      logger.error(
        `Unable to restart all games in game server. Error: ${err.message}`
      );
      const response = {
        error: err.message,
      };
      resp.status(500).send(JSON.stringify(response));
      return;
    }

    try {
      await restartGameServerGames(gameServer);
    } catch (err) {
      logger.error(
        `Unable to restart all games in game server ${gameServer.id} (url: ${gameServer.url})`
      );
      const response = {
        error: err.message,
      };
      resp.status(500).send(JSON.stringify(response));
      return;
    }
    resp.status(200).send(JSON.stringify({status: 'OK'}));
  }

  public async setMaxGames(req: any, resp: any) {
    const payload = req.body;
    if (!payload) {
      logger.error(`setMaxGames could not get request payload`);
      const response = {
        error: 'Could not get request payload',
      };
      resp.status(500).send(JSON.stringify(response));
      return;
    }
    const gameServerId: number = payload.gameServerId;
    const numGames: number = payload.numGames;
    if (!gameServerId || numGames === undefined || numGames === null) {
      logger.error(`setMaxGames invalid payload: ${JSON.stringify(payload)}`);
      const response = {
        error: 'gameServerId and numGames must be provided',
      };
      resp.status(500).send(JSON.stringify(response));
      return;
    }

    try {
      const result = await getGameRepository(GameServer).update(
        {
          id: gameServerId,
        },
        {
          maxGames: numGames,
        }
      );
      if (result.affected === 0) {
        const msg = `No game server found with ID ${gameServerId}. Affected rows: ${result.affected}`;
        logger.error(msg);
        resp.status(500).send(JSON.stringify({error: msg}));
        return;
      }
      logger.info(
        `Updated max games for game server ID ${gameServerId} to ${numGames}`
      );
      resp.status(200).send(JSON.stringify({status: 'OK'}));
    } catch (err) {
      const msg = `Could not set max games for game server ID ${gameServerId}: `;
      logger.error(msg + errToLogString(err));
      resp
        .status(500)
        .send(JSON.stringify({error: msg + errToLogString(err, false)}));
    }
  }
}

export const GameServerAPI = new GameServerAPIs();

export async function createGameServer(
  registerPayload: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<[any, any]> {
  try {
    if (!registerPayload.url) {
      registerPayload.url = `http://${registerPayload.ipAddress}:8080`;
    }

    let url: string = registerPayload.url;
    url = url.toLowerCase();

    // HACK: SOMA: The name resloution is slow in my system for some reasons
    if (url.indexOf('mayas-macbook-pro.local') != -1) {
      url = url.replace('mayas-macbook-pro.local', '127.0.0.1');
    }

    const gameServerRepository = getGameRepository(GameServer);
    let gameServer = await gameServerRepository.findOne({
      url: url,
    });
    if (!gameServer) {
      gameServer = new GameServer();
      gameServer.noGamesHandled = 0;
      gameServer.noPlayersHandled = 0;
    }

    logger.debug('Getting next game server number');
    // get next game server number
    gameServer.serverNumber = await GameRepository.getNextGameServer();
    logger.debug(`Next game server number: ${gameServer.serverNumber}`);

    const gameServerStatus: string = registerPayload.status;
    gameServer.ipAddress = registerPayload.ipAddress;
    gameServer.currentMemory = registerPayload.currentMemory;
    gameServer.startingMemory = registerPayload.currentMemory;
    gameServer.status = GameServerStatus[gameServerStatus];
    gameServer.startedAt = new Date();
    gameServer.lastHeartBeatTime = new Date();
    gameServer.noActiveGames = 0;
    gameServer.noActivePlayers = 0;
    gameServer.url = url; //registerPayload.url;

    //gameServer.serverNumber = 1;
    await gameServerRepository.save(gameServer);
    return [gameServer, null];
  } catch (err) {
    logger.error(`Registering game server failed. Error: ${err.toString()}`);
    return [null, err];
  }
}

async function restartGameServerGames(
  gameServer: GameServer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<void> {
  const games: Array<PokerGame> =
    await GameServerRepository.getGamesForGameServer(gameServer.url);
  for (const game of games) {
    restartGame(game, gameServer).catch(reason => {
      logger.error(
        `Failed to restart game ${game.id}/${game.gameCode} on game server ${
          gameServer.url
        }: ${reason.toString()}`
      );
    });
  }
}

async function restartGame(game: PokerGame, gameServer: any): Promise<void> {
  const maxAttempts = 5;
  logger.info(
    `Restarting game ${game.id}/${game.gameCode} in game server ID: ${gameServer.id} url: ${gameServer.url}`
  );
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      if (i > 1) {
        logger.info(
          `Restarting game ${game.id}/${game.gameCode}...(${i}/${maxAttempts})`
        );
        await delay(getRandomNum(1000, 3000));
      }
      await publishNewGame(game, gameServer, true);
      logger.info(`Successfully restarted game ${game.id}/${game.gameCode}`);
      return;
    } catch (err) {
      logger.error(
        `Error while restarting game ${game.id}/${game.gameCode}: ${err.message}`
      );
    }
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomNum(min: number, max: number) {
  return Math.round(Math.random() * (max - min) + min);
}

export async function editGameServer(gameServerPayload: any) {
  try {
    const gameServerRepository = getGameRepository(GameServer);
    const gameServer = await gameServerRepository.findOne({
      where: {ipAddress: gameServerPayload.ipAddress},
    });
    if (!gameServer) {
      return `gameserver ${gameServerPayload.ipAddress} is not found`;
    }
    if (gameServerPayload.status) {
      gameServer.status = gameServerPayload.status;
    }
    if (gameServerPayload.status) {
      const gameServerStatus: string = gameServerPayload.status;
      gameServer.status = GameServerStatus[gameServerStatus];
    }
    if (gameServerPayload.noGamesHandled) {
      gameServer.noGamesHandled += gameServerPayload.noGamesHandled;
    }
    if (gameServerPayload.noActiveGames) {
      gameServer.noActiveGames = gameServerPayload.noActiveGames;
    }
    if (gameServerPayload.noActivePlayers) {
      gameServer.noActivePlayers = gameServerPayload.noActivePlayers;
    }
    if (gameServerPayload.noPlayersHandled) {
      gameServer.noPlayersHandled += gameServerPayload.noPlayersHandled;
    }
    gameServer.lastHeartBeatTime = new Date();
    await gameServerRepository.update({id: gameServer.id}, gameServer);
    return true;
  } catch (err) {
    return err;
  }
}

export async function getAllGameServers() {
  const gameServerRepository = getGameRepository(GameServer);
  const gameServers = await gameServerRepository.find();
  return gameServers;
}
