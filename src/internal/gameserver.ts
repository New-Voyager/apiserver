import {getRepository} from 'typeorm';
import {
  GameServer,
  GameServerStatus,
  TrackGameServer,
} from '@src/entity/gameserver';
import {STATUS_CODES} from 'http';

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
      if (!registerPayload.status) {
        errors.push('status is missing');
      } else {
        if (
          registerPayload.status != GameServerStatus[GameServerStatus.ACTIVE] &&
          registerPayload.status != GameServerStatus[GameServerStatus.DOWN]
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

    try {
      const gameServerRepository = getRepository(GameServer);
      let gameServer = await gameServerRepository.findOne({
        ipAddress: registerPayload.ip_address,
      });
      if (!gameServer) {
        gameServer = new GameServer();
        gameServer.noGamesHandled = 0;
        gameServer.noPlayersHandled = 0;
      }
      const gameServerStatus: string = registerPayload.status;
      gameServer.ipAddress = registerPayload.ipAddress;
      gameServer.currentMemory = registerPayload.currentMemory;
      gameServer.startingMemory = registerPayload.currentMemory;
      gameServer.status = GameServerStatus[gameServerStatus];
      gameServer.startedAt = new Date();
      gameServer.lastHeartBeatTime = new Date();
      gameServer.noActiveGames = 0;
      gameServer.noActivePlayers = 0;
      await gameServerRepository.save(gameServer);
      resp.status(200).send(JSON.stringify({status: 'OK'}));
    } catch (err) {
      resp.status(500);
      return;
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
    const gameServerPayload = req.body;
    const gameServerRepository = getRepository(GameServer);
    const gameServer = await gameServerRepository.findOne({
      where: {ipAddress: gameServerPayload.ipAddress},
    });
    if (!gameServer) {
      resp
        .status(500)
        .send(`gameserver ${gameServerPayload.ipAddress} is not found`);
      return;
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
    resp.status(200).send(JSON.stringify({status: 'OK'}));
  }

  public async getGameServers(req: any, resp: any) {
    const gameServerRepository = getRepository(GameServer);
    const gameServers = await gameServerRepository.find();
    resp.status(200).send(JSON.stringify({servers: gameServers}));
  }

  public async getSpecificGameServer(req: any, resp: any) {
    const clubId = req.params.clubId;
    const gameNum = req.params.gameNum;
    const errors = new Array<string>();
    try {
      if (!clubId) {
        errors.push('clubId is missing');
      }
      if (!gameNum) {
        errors.push('gameNum is missing');
      }
    } catch (err) {
      resp.status(500).send('Internal service error');
      return;
    }

    if (errors.length) {
      resp.status(500).send(JSON.stringify(errors));
      return;
    }

    const trackGameServerRepository = getRepository(TrackGameServer);
    const trackGameServer = await trackGameServerRepository.findOne({
      relations: ['gameServerId'],
      where: {clubId: clubId, gameNum: gameNum},
    });
    resp.status(200).send(JSON.stringify({server: trackGameServer}));
  }
}

export const GameServerAPI = new GameServerAPIs();
