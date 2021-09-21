import {PokerGame} from '@src/entity/game/game';
import {GameServer} from '@src/entity/game/gameserver';
import {getLogger} from '@src/utils/log';
import {getGameConnection, getGameRepository} from '.';
import {Cache} from '@src/cache/index';
import {fixQuery} from '@src/utils';
import {GameServerStatus, GameStatus} from '@src/entity/types';
import {EntityManager, Repository} from 'typeorm';

const logger = getLogger('repositories::gameserver');

class GameServerRepositoryImpl {
  public async getNextGameServer(): Promise<GameServer> {
    const gameServerRepository = getGameRepository(GameServer);
    let gameServers = await gameServerRepository
      .createQueryBuilder()
      .where({
        status: GameServerStatus.ACTIVE,
      })
      .orderBy('id', 'ASC')
      .getMany();

    if (gameServers.length === 0) {
      throw new Error('No game server is available');
    }

    // get next game server that has not reached maximum number of games
    let nextServer = gameServers[0];
    let noActiveGames = gameServers[0].noActiveGames;
    for (const server of gameServers) {
      if (server.noActiveGames < server.maxGames) {
        return server;
      }
      if (server.noActiveGames < noActiveGames) {
        nextServer = server;
        noActiveGames = server.noActiveGames;
      }
    }

    // Should only get here if all available servers are full.
    // Just return the server that has the fewest games.
    return nextServer;
  }

  public async gameAdded(
    gameServerUrl: string,
    transactionManager?: EntityManager
  ) {
    let gameServerRepo: Repository<GameServer>;
    if (transactionManager) {
      gameServerRepo = transactionManager.getRepository(GameServer);
    } else {
      gameServerRepo = getGameRepository(GameServer);
    }

    await gameServerRepo
      .createQueryBuilder()
      .update()
      .set({
        noActiveGames: () => 'no_active_games + 1',
        noGamesHandled: () => 'no_games_handled + 1',
      })
      .where({url: gameServerUrl})
      .execute();
  }

  public async gameRemoved(
    gameServerUrl: string,
    transactionManager?: EntityManager
  ) {
    let gameServerRepo: Repository<GameServer>;
    if (transactionManager) {
      gameServerRepo = transactionManager.getRepository(GameServer);
    } else {
      gameServerRepo = getGameRepository(GameServer);
    }

    await gameServerRepo.decrement({url: gameServerUrl}, 'noActiveGames', 1);
  }

  public async get(
    url: string,
    transactionManager?: EntityManager
  ): Promise<GameServer | null> {
    const gameServer = await Cache.getGameServer(
      url,
      false,
      transactionManager
    );
    return gameServer;
  }

  public async getGamesForGameServer(
    gameServerUrl: string
  ): Promise<Array<PokerGame>> {
    const gameRepo = getGameRepository(PokerGame);
    const games = await gameRepo.find({
      gameServerUrl: gameServerUrl,
      status: GameStatus.ACTIVE,
    });
    return games;
  }
}

export const GameServerRepository = new GameServerRepositoryImpl();
