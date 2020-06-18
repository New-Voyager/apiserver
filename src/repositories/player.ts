import {getRepository} from 'typeorm';
import {v4 as uuidv4} from 'uuid';
import {Player} from '@src/entity/player';

class PlayerRepositoryImpl {
  public async createPlayer(name: string, deviceId: string): Promise<string> {
    const repository = getRepository(Player);
    // if a player already exists with the device id, update the user name
    let player = await repository.findOne({where: {deviceId: deviceId}});
    if (player) {
      player.isActive = true;
    } else {
      player = new Player();
      player.uuid = uuidv4();
    }
    player.name = name;
    player.isActive = true;
    player.deviceId = deviceId;

    await repository.save(player);
    return player.uuid;
  }
}

export const PlayerRepository = new PlayerRepositoryImpl();
