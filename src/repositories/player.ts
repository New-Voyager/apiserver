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
import {UserRegistrationPayload} from '@src/types';
import {sendRecoveryCode} from '@src/email';
import {getRecoveryCode} from '@src/utils/uniqueid';

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
        if (data.club.owner) {
          host = data.club.owner as Player;
          await Firebase.playerRenamed(host, player.name, name);
        }
      }
    }
    await Cache.getPlayer(playerId, true);
    return true;
  }

  public async getPlayerUsingDeviceId(
    deviceId: string
  ): Promise<Player | null> {
    const repository = getUserRepository(Player);
    let player = await repository.findOne({
      deviceId: deviceId,
    });
    if (!player) {
      return null;
    }
    return player;
  }

  public async registerUser(
    register: UserRegistrationPayload
  ): Promise<Player> {
    const repository = getUserRepository(Player);
    let player = await repository.findOne({
      deviceId: register.deviceId,
    });
    if (player) {
      throw new Error('Player with device id already exists');
    }

    if (register.recoveryEmail && register.recoveryEmail.length > 0) {
      // make sure the recovery email address is not reused
      player = await repository.findOne({
        recoveryEmail: register.recoveryEmail,
      });
      if (!player) {
        throw new Error(
          'Another device is registered with this recovery email address'
        );
      }
    }

    player = new Player();
    player.name = register.name;
    player.displayName = register.displayName;
    player.recoveryEmail = register.recoveryEmail;
    player.deviceId = register.deviceId;
    player.deviceSecret = uuidv4();
    player.uuid = uuidv4();
    player.isActive = true;
    player.encryptionKey = uuidv4();
    register.bot = false;
    if (register.bot) {
      player.bot = true;
    }

    await repository.save(player);
    await StatsRepository.newPlayerHandStats(player);
    return player;
  }

  public async sendRecoveryCode(email: string): Promise<boolean> {
    const repository = getUserRepository(Player);
    let player = await repository.findOne({
      recoveryEmail: email,
    });
    if (!player) {
      throw new Error(`${email} is not a registered email`);
    }

    const code = getRecoveryCode(email);
    try {
      await repository.update(
        {
          id: player.id,
        },
        {
          recoveryCode: code,
        }
      );
    } catch (err) {
      throw new Error('Failed to generate recovery code. Retry again');
    }

    try {
      sendRecoveryCode(email, null, code);
      return true;
    } catch (err) {
      throw err;
    }
  }

  public async loginUsingRecoveryCode(
    deviceId: string,
    email: string,
    code: string
  ): Promise<Player> {
    const repository = getUserRepository(Player);
    let player = await repository.findOne({
      recoveryEmail: email,
    });
    if (!player) {
      throw new Error(`${email} is not a registered email`);
    }

    try {
      if (player.recoveryCode !== code) {
        throw new Error('Recovery code does not match');
      }
      // generate new device secret
      player.deviceSecret = uuidv4();
      player.isActive = true;
      player.deviceSecret = uuidv4();
      await repository.save(player);
      return player;
    } catch (err) {
      throw err;
    }
  }
}

export const PlayerRepository = new PlayerRepositoryImpl();
