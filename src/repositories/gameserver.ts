import {PokerGame} from '@src/entity/game/game';
import {GameServer} from '@src/entity/game/gameserver';
import {getLogger} from '@src/utils/log';
import {getGameRepository} from '.';
import {Cache} from '@src/cache/index';

const logger = getLogger('game_server');

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

  public async get(url: string): Promise<GameServer | null> {
    const gameServer = await Cache.getGameServer(url);
    return gameServer;
  }
}

export const GameServerRepository = new GameServerRepositoryImpl();
