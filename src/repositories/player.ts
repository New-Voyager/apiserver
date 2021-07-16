import {EntityManager, Repository, In} from 'typeorm';
import {v4 as uuidv4} from 'uuid';
import {Player, PlayerNotes} from '@src/entity/player/player';
import {getLogger} from '@src/utils/log';
const logger = getLogger('player');
import {Cache} from '@src/cache/index';
import {StatsRepository} from './stats';
import {Firebase} from '@src/firebase';
import {getUserRepository} from '.';
import {Club, ClubMember} from '@src/entity/player/club';
import {HostMessageRepository} from '@src/repositories/hostmessage';
import {HostMessageType} from '../entity/types';

class PlayerRepositoryImpl {
  public async createPlayer(
    name: string,
    email: string,
    password: string,
    deviceId: string,
    isBot: boolean
  ): Promise<string> {
    const repository = getUserRepository(Player);
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
    player.encryptionKey = uuidv4();

    await repository.save(player);
    await StatsRepository.newPlayerHandStats(player);
    return player.uuid;
  }

  // Updates firebase token for the player
  public async updateFirebaseToken(playerId: string, token: string) {
    const player = await getUserRepository(Player).findOne({
      uuid: playerId,
    });
    if (!player) {
      logger.error(`Player is not found for uuid: ${playerId}`);
      throw new Error(`Player is not found for uuid: ${playerId}`);
    }

    logger.info(`Updated token for player: ${player.name} token: ${token}`);
    await getUserRepository(Player).update(
      {
        uuid: playerId,
      },
      {
        firebaseToken: token,
      }
    );
  }

  public async getPlayers(): Promise<Array<any>> {
    const repository = getUserRepository(Player);
    // get all players (testing only)
    const players = await repository.find();
    return players;
  }

  public async getPlayerById(playerId: string): Promise<Player | undefined> {
    const repository = getUserRepository(Player);
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
      repository = getUserRepository(Player);
    }

    // get player by id (testing only)
    const player = await repository.findOne({where: {id: id}});
    return player;
  }

  public async getPlayerInfo(playerId: string): Promise<Player | undefined> {
    const repository = getUserRepository(Player);
    // get player by id (testing only)
    const player = await repository.findOne({where: {uuid: playerId}});
    return player;
  }

  public async idsToPlayerInfo(ids: Array<number>): Promise<Array<Player>> {
    const repository = getUserRepository(Player);
    const resp = await repository.find({
      where: {
        id: In(ids),
      },
    });
    return resp;
  }

  // Updates firebase token for the player
  public async getNotes(
    playerId: string,
    notesPlayerId: number,
    notesPlayerUuid: string
  ): Promise<string> {
    const player = await Cache.getPlayer(playerId);
    let notesPlayer;
    if (notesPlayerId) {
      notesPlayer = await Cache.getPlayerById(notesPlayerId);
    } else if (notesPlayerUuid) {
      notesPlayer = await Cache.getPlayer(notesPlayerUuid);
    }
    if (!notesPlayer) {
      throw new Error('Could not get notes palyer id');
    }
    const notesRepo = getUserRepository(PlayerNotes);
    const notes = await notesRepo.findOne({
      player: {id: player.id},
      notesToPlayer: {id: notesPlayer.id},
    });
    if (!notes) {
      return '';
    }
    return notes.notes;
  }

  public async updateNotes(
    playerId: string,
    notesPlayerId: number,
    notesPlayerUuid: string,
    notes: string
  ) {
    const player = await Cache.getPlayer(playerId);
    let notesPlayer;
    if (notesPlayerId) {
      notesPlayer = await Cache.getPlayerById(notesPlayerId);
    } else if (notesPlayerUuid) {
      notesPlayer = await Cache.getPlayer(notesPlayerUuid);
    }
    if (!notesPlayer) {
      throw new Error('Could not get notes palyer id');
    }
    const notesRepo = getUserRepository(PlayerNotes);
    let affectedRows = await notesRepo.update(
      {
        player: {id: player.id},
        notesToPlayer: {id: notesPlayer.id},
      },
      {
        notes: notes,
      }
    );
    if (affectedRows.affected == 0) {
      // insert
      affectedRows = await notesRepo.insert({
        player: {id: player.id},
        notesToPlayer: {id: notesPlayer.id},
        notes: notes,
      });
    }
    logger.info(`Affected rows: ${affectedRows}`);
  }

  public async sendFcmMessage(player: Player, message: any) {
    await Firebase.sendPlayerMsg(player, message);
  }

  public async changeDisplayName(playerId: string, name: string) {
    const player = await Cache.getPlayer(playerId);
    if (!player) {
      throw new Error('Could not get player data');
    }
    const playerRepo = getUserRepository(Player);
    const affectedRows = await playerRepo.update(
      {
        id: player.id,
      },
      {
        name: name,
      }
    );
    logger.info(`Affected rows: ${affectedRows}`);
    if (affectedRows.affected != 0) {
      // member -> host message
      const clubMemberRepo = getUserRepository(ClubMember);
      const playerClubs = await clubMemberRepo.find({
        relations: ['club', 'player'],
        where: {
          player: {id: player.id},
        },
      });
      logger.info(`player Clubs: ${playerClubs}`);
      for await (const data of playerClubs) {
        await HostMessageRepository.sendHostMessage(
          data.club,
          data,
          `Player ${player.name} changed name to ${name}`,
          HostMessageType.TO_HOST
        );
        let host: Player;
        if(data.club.owner){
          host = (data.club.owner) as Player
          await Firebase.playerRenamed(host, player.name, name);
        }
      }
    }
    await Cache.getPlayer(playerId, true);
    return true;
  }
}

export const PlayerRepository = new PlayerRepositoryImpl();
