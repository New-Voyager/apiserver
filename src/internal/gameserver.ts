import {getRepository} from 'typeorm';
import {GameServer, TrackGameServer} from '@src/entity/gameserver';
import {GameServerStatus, GameStatus} from '@src/entity/types';
import {STATUS_CODES} from 'http';
import {GameRepository} from '@src/repositories/game';
import {getLogger} from '@src/utils/log';
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
        //errors.push('url field is missing');
        registerPayload['url'] = `http://${registerPayload.ipAddress}/url`;
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
    const clubCode = req.params.clubCode;
    const gameCode = req.params.gameCode;
    const errors = new Array<string>();
    try {
      if (!clubCode) {
        errors.push('clubCode is missing');
      }
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
    const response = await getParticularGameServer(clubCode, gameCode);
    resp.status(200).send(JSON.stringify({server: response}));
  }

  public async restartGames(req: any, resp: any) {
    const gameServer = req.params.gameServer;
    const errors = new Array<string>();
    if (!gameServer) {
      errors.push('gameServer parameter is missing');
    }
    if (errors.length) {
      resp.status(400).send(JSON.stringify({errors: errors}));
      return;
    }
    const url = `http://${gameServer}:8080`;
    const gameCodes = await getGamesForGameServer(url);
    resp.status(200).send(JSON.stringify({gameCodes: gameCodes}));
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

    const gameServerRepository = getRepository(GameServer);
    let gameServer = await gameServerRepository.findOne({
      url: registerPayload.url,
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
    gameServer.url = registerPayload.url;

    //gameServer.serverNumber = 1;
    await gameServerRepository.save(gameServer);
    return [gameServer, null];
  } catch (err) {
    logger.error(`Registering game server failed. Error: ${err.toString()}`);
    return [null, err];
  }
}

export async function editGameServer(gameServerPayload: any) {
  try {
    const gameServerRepository = getRepository(GameServer);
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
  const gameServerRepository = getRepository(GameServer);
  const gameServers = await gameServerRepository.find();
  return gameServers;
}

export async function getParticularGameServer(
  clubCode: string,
  gameCode: string
) {
  const game = await GameRepository.getGameByCode(gameCode);
  if (!game) {
    throw new Error('Game not found');
  }
  const trackGameServerRepository = getRepository(TrackGameServer);
  const trackGameServer = await trackGameServerRepository.findOne({
    where: {
      game: {id: game.id},
    },
  });
  return trackGameServer;
}

export async function getGamesForGameServer(
  gameServerUrl: string
): Promise<Array<string>> {
  const gameServerRepository = getRepository(GameServer);
  const gameServer = await gameServerRepository.findOne({
    where: {url: gameServerUrl},
  });
  if (!gameServer) {
    return [];
  }
  const trackGameServerRepository = getRepository(TrackGameServer);
  const res = await trackGameServerRepository.find({
    where: {gameServer: gameServer},
  });

  return res
    .filter(g => g.game.status == GameStatus.ACTIVE)
    .map(g => g.game.gameCode);
}
