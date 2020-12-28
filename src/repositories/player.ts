import {EntityManager, Repository, getRepository} from 'typeorm';
import {v4 as uuidv4} from 'uuid';
import {Player} from '@src/entity/player';

class PlayerRepositoryImpl {
  public async createPlayer(
    name: string,
    email: string,
    password: string,
    deviceId: string,
    isBot: boolean
  ): Promise<string> {
    const repository = getRepository(Player);
    let player: Player | undefined;
    if (email) {
      player = await repository.findOne({where: {email: email}});
    } else {
      player = await repository.findOne({where: {deviceId: deviceId}});
    }
    // if a player already exists with the device id, update the user name
    if (player) {
      player.isActive = true;
    } else {
      player = new Player();
      // use device id as player uuid (easy for testing)
      if (deviceId) {
        player.uuid = deviceId;
      } else {
        player.uuid = uuidv4();
      }
    }
    player.name = name;
    player.email = email;
    player.password = password;
    player.isActive = true;
    player.deviceId = deviceId;
    player.bot = isBot;

    await repository.save(player);
    return player.uuid;
  }

  public async getPlayers(): Promise<Array<any>> {
    const repository = getRepository(Player);
    // get all players (testing only)
    const players = await repository.find();
    return players;
  }

  public async getPlayerById(playerId: string): Promise<Player | undefined> {
    const repository = getRepository(Player);
    // get player by id (testing only)
    const player = await repository.findOne({where: {uuid: playerId}});
    return player;
  }

  public async getPlayerByDBId(
    id: number,
    transactionManager?: EntityManager
  ): Promise<Player | undefined> {
    let repository: Repository<Player>;
    if (transactionManager) {
      repository = transactionManager.getRepository(Player);
    } else {
      repository = getRepository(Player);
    }

    // get player by id (testing only)
    const player = await repository.findOne({where: {id: id}});
    return player;
  }

  public async getPlayerInfo(playerId: string): Promise<Player | undefined> {
    const repository = getRepository(Player);
    // get player by id (testing only)
    const player = await repository.findOne({where: {uuid: playerId}});
    return player;
  }
}

export const PlayerRepository = new PlayerRepositoryImpl();
