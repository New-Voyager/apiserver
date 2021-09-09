import {PokerGame} from '@src/entity/game/game';
import {GameServer} from '@src/entity/game/gameserver';
import {getLogger} from '@src/utils/log';
import {getGameConnection, getGameRepository} from '.';
import {Cache} from '@src/cache/index';
import {fixQuery} from '@src/utils';
import {GameStatus} from '@src/entity/types';
import {EntityManager} from 'typeorm';

const logger = getLogger('repositories::gameserver');

class GameServerRepositoryImpl {
  public async getNextGameServer(): Promise<GameServer> {
    const gameServerRepository = getGameRepository(GameServer);
    let gameServers = await gameServerRepository.find();
    if (gameServers.length === 0) {
      throw new Error('No game server is availabe');
    }

    // get next game server that has not reached maximum number of games
    return gameServers[0];
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
