import {Club, ClubMember} from '@src/entity/player/club';
import {ClubMemberStatus, ClubStatus} from '@src/entity/types';
import {Player} from '@src/entity/player/player';
import {Not, LessThan, MoreThan, In} from 'typeorm';
import {PokerGame} from '@src/entity/game/game';
import {
  getClubGamesData,
  getMembersFilterData,
  getPlayerClubsData,
  PageOptions,
} from '@src/types';
import {getLogger} from '@src/utils/log';
import {getClubCode} from '@src/utils/uniqueid';
import {fixQuery} from '@src/utils';
import {Cache} from '@src/cache';
import {ClubMemberFirebaseToken, ClubUpdateType} from './types';
import {Nats} from '@src/nats';
import {v4 as uuidv4} from 'uuid';
import {StatsRepository} from './stats';
import {Firebase, getAppSettings} from '@src/firebase';
import {
  getGameConnection,
  getHistoryRepository,
  getUserConnection,
  getUserManager,
  getUserRepository,
} from '.';
import {ClubMemberStat} from '@src/entity/player/club';
import {ClubMessageRepository} from './clubmessage';
import {AppCoinRepository} from './appcoin';
import {Errors, GenericError} from '@src/errors';
import _ from 'lodash';
import { getRunProfile, RunProfile } from '@src/server';

const logger = getLogger('repositories::club');

export interface ClubCreateInput {
  ownerUuid: string;
  name: string;
  description: string;
}

export interface ClubUpdateInput {
  name: string;
  description: string;
  showHighRankStats: boolean;
}

export interface ClubMemberUpdateInput {
  isManager?: boolean;
  notes?: string;
  balance?: number;
  status?: ClubMemberStatus;
  creditLimit?: number;
  autoBuyinApproval?: boolean;
  referredBy?: string;
  contactInfo?: string;
}

class ClubRepositoryImpl {
  public async updateClubMember(
    hostUuid: string,
    playerUuid: string,
    clubCode: string,
    updateData: ClubMemberUpdateInput
  ): Promise<ClubMemberStatus> {
    const clubRepository = getUserRepository<Club>(Club);
    const playerRepository = getUserRepository<Player>(Player);
    const clubMemberRepository = getUserRepository<ClubMember>(ClubMember);

    // Check club data
    const club = await clubRepository.findOne({where: {clubCode: clubCode}});
    if (!club) {
      throw new Error(`Club: ${clubCode} does not exist`);
    }

    // Check player data
    const player = await playerRepository.findOne({where: {uuid: playerUuid}});
    if (!player) {
      throw new Error(`Player ${playerUuid} is not found`);
    }

    // Check owner data
    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }
    if (owner.uuid !== hostUuid) {
      throw new Error('Unauthorized!');
    }

    // Check ClubMember data
    const clubMember = await clubMemberRepository.findOne({
      where: {
        club: {id: club.id},
        player: {id: player.id},
      },
    });
    if (!clubMember) {
      throw new Error(`The player ${player.name} is not in the club`);
    }

    // update data
    if (updateData.balance) {
      clubMember.balance = updateData.balance;
    }
    if (updateData.creditLimit) {
      clubMember.creditLimit = updateData.creditLimit;
    }
    if (updateData.notes) {
      clubMember.notes = updateData.notes.toString();
    }
    if (updateData.status) {
      clubMember.status = (ClubMemberStatus[
        updateData.status
      ] as unknown) as ClubMemberStatus;
    }
    if (updateData.isManager || updateData.isManager === false) {
      clubMember.isManager = updateData.isManager;
    }
    if (
      updateData.autoBuyinApproval ||
      updateData.autoBuyinApproval === false
    ) {
      clubMember.autoBuyinApproval = updateData.autoBuyinApproval;
    }
    if (updateData.referredBy) {
      clubMember.referredBy = updateData.referredBy.toString();
    }

    if (updateData.contactInfo) {
      clubMember.contactInfo = updateData.contactInfo.toString();
    }

    // Save the data
    const resp = await clubMemberRepository.save(clubMember);
    await Cache.getClubMember(player.uuid, clubCode, true /* update cache */);
    return clubMember.status;
  }

  public async getClub(clubCode: string): Promise<Club | undefined> {
    const clubRepository = getUserRepository(Club);
    const club = await clubRepository.findOne({where: {clubCode: clubCode}});
    return club;
  }

  public async updateClub(
    clubCode: string,
    input: ClubUpdateInput,
    club?: Club
  ): Promise<boolean> {
    const clubRepository = getUserRepository(Club);

    if (!club) {
      club = await clubRepository.findOne({where: {clubCode: clubCode}});
      if (!club) {
        throw new Error(`Club ${clubCode} is not found`);
      }
    }

    if (input.name) {
      club.name = input.name;
    }
    if (input.description) {
      club.description = input.description;
    }
    if (input.showHighRankStats !== undefined) {
      club.showHighRankStats = input.showHighRankStats;
    }
    await clubRepository.save(club);
    return true;
  }

  public async getClubCount(): Promise<number> {
    const clubRepository = getUserRepository(Club);
    return clubRepository.count();
  }

  public async createClub(input: ClubCreateInput): Promise<string> {
    // whoever creates this club is the owner of the club
    let clubCode = '';
    const clubRepository = getUserRepository(Club);

    while (true) {
      // generate a club code
      clubCode = await getClubCode(input.name);
      //clubCode = 'TEST';
      const club = await clubRepository.findOne({where: {clubCode: clubCode}});

      if (!club) {
        // if the club doesn't exist, we can use it
        break;
      }
    }

    // locate the owner
    const playerRepository = getUserRepository<Player>(Player);
    const owner = await playerRepository.findOne({
      where: {uuid: input.ownerUuid},
    });
    if (!owner) {
      throw new Error(`Owner ${input.ownerUuid} is not found`);
    }
    const club = new Club();
    club.name = input.name;
    club.description = input.description;
    club.clubCode = clubCode;
    club.status = ClubStatus.ACTIVE;
    const ownerObj = await playerRepository.findOne({
      where: {uuid: input.ownerUuid},
    });
    if (!ownerObj) {
      throw new Error('Owner is not found');
    }
    club.owner = ownerObj;

    // create a new membership for the owner
    const clubMember = new ClubMember();
    clubMember.club = club;
    clubMember.player = owner;
    clubMember.isOwner = true;
    clubMember.joinedDate = new Date();
    clubMember.status = ClubMemberStatus.ACTIVE;
    clubMember.lastGamePlayedDate = new Date();

    //logger.info('****** STARTING TRANSACTION TO SAVE club and club member');
    await getUserManager().transaction(async transactionEntityManager => {
      const clubMemberRepo = transactionEntityManager.getRepository<ClubMember>(
        ClubMember
      );
      const clubCount = await clubMemberRepo.count({
        player: {id: owner.id},
      });
      const appSettings = getAppSettings();
      if (clubCount >= appSettings.maxClubCount) {
        throw new GenericError(
          Errors.MAXCLUB_REACHED,
          'Max club count reached'
        );
      }

      const clubRepo = transactionEntityManager.getRepository(Club);
      await clubRepo.save(club);
      await clubMemberRepo.save(clubMember);

      if (clubCount === 0) {
        // if this is the first club for the user, add first time club owner coins
        let firstClubCoins = appSettings.clubHostFreeCoins;
        if (getRunProfile() == RunProfile.DEV) {
          firstClubCoins = 1000;
        }
        await AppCoinRepository.addCoins(
          0,
          firstClubCoins,
          ownerObj.uuid
        );
      }
      await StatsRepository.newClubStats(club);
    });

    //logger.info('****** ENDING TRANSACTION  SAVE club and club member');

    return club.clubCode;
  }

  public async deleteClub(clubCode: string) {
    const clubRepository = getUserRepository(Club);
    const club = await clubRepository.findOne({where: {clubCode: clubCode}});
    if (!club) {
      throw new Error(`Club: ${clubCode} does not exist`);
    }
    // we won't delete the club
    // we will simply defunct the club
    club.status = ClubStatus.DEFUNCT;
    await clubRepository.save(club);
  }

  // This is an internal API
  public async deleteClubByName(clubName: string) {
    const clubRepository = getUserRepository(Club);
    const club = await clubRepository.findOne({where: {name: clubName}});
    if (club) {
      logger.debug('****** STARTING TRANSACTION TO delete club');
      await getUserManager().transaction(async transactionEntityManager => {
        await transactionEntityManager
          .createQueryBuilder()
          .delete()
          .from(ClubMember)
          .where('club_id = :id', {id: club.id})
          .execute();
        await transactionEntityManager.getRepository(Club).delete(club);
      });
      logger.debug('****** ENDING TRANSACTION TO delete club');
    }
  }

  public async isClubOwner(clubCode: string, playerId: string) {
    const clubRepository = getUserRepository(Club);
    const club = await clubRepository.findOne({where: {clubCode: clubCode}});
    if (!club) {
      throw new Error(`Club: ${clubCode} does not exist`);
    }

    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    if (owner.uuid === playerId) {
      return true;
    }
    return false;
  }

  public async joinClub(
    clubCode: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    clubCode = clubCode.toLowerCase();
    let clubMember = await Cache.getClubMember(playerId, clubCode, true);
    const player = await Cache.getPlayer(playerId);
    const clubMemberRepository = getUserRepository<ClubMember>(ClubMember);
    if (clubMember) {
      if (player.bot) {
        clubMember.status = ClubMemberStatus.ACTIVE;
        await clubMemberRepository.update(
          {
            id: clubMember.id,
          },
          {
            status: ClubMemberStatus.ACTIVE,
          }
        );
      }
      if (clubMember.status !== ClubMemberStatus.ACTIVE) {
        // make it pending
        await clubMemberRepository.update(
          {
            id: clubMember.id,
          },
          {
            status: ClubMemberStatus.PENDING,
          }
        );
        clubMember.status = ClubMemberStatus.PENDING;
        await Cache.getClubMember(playerId, clubCode, true);
      }
      return clubMember.status;
    }
    const club = await Cache.getClub(clubCode);

    // create a new membership
    clubMember = new ClubMember();
    clubMember.club = await Cache.getClub(clubCode);
    clubMember.player = await Cache.getPlayer(playerId);
    clubMember.joinedDate = new Date();
    clubMember.status = ClubMemberStatus.PENDING;
    clubMember.lastGamePlayedDate = new Date();

    const clubMemberStatRepository = getUserRepository(ClubMemberStat);
    let clubMemberStat = await clubMemberStatRepository.findOne({
      clubId: club.id,
      playerId: clubMember.player.id,
    });
    if (!clubMemberStat) {
      clubMemberStat = new ClubMemberStat();
      clubMemberStat.clubId = club.id;
      clubMemberStat.playerId = clubMember.player.id;
      await clubMemberStatRepository.save(clubMemberStat);
    }

    if (player.bot) {
      // bots are allowed to buy as much as they wantt
      clubMember.status = ClubMemberStatus.ACTIVE;
      clubMember.autoBuyinApproval = true;

      if (player.uuid === 'c2dc2c3d-13da-46cc-8c66-caa0c77459de') {
        // Making one of the bots as the manager.
        // This is for the botrunner to start an app game with a club created by a human.
        clubMember.isManager = true;
      }
      await ClubMessageRepository.playerJoined(club, player);
    }

    await clubMemberRepository.save(clubMember);
    const messageId = uuidv4();
    try {
      // TODO: send firebase notification
      Nats.sendClubUpdate(
        clubCode,
        club.name,
        ClubUpdateType[ClubUpdateType.NEW_MEMBER],
        messageId
      );
      const owner: Player | undefined = await Promise.resolve(club.owner);
      if (!owner) {
        throw new Error('Unexpected. There is no owner for the club');
      }
      Firebase.clubMemberJoinRequest(club, owner, player).catch(e => {
        logger.error(`Failed to send firebase message. Error: ${e.message}`);
      });
    } catch (err) {
      logger.error(`Failed to send NATS message. Error: ${err.toString()}`);
    }
    return clubMember.status;
  }

  public async clubLeaderBoard(clubId: number) {
    const clubMemberStatStatsRepo = getUserRepository(ClubMemberStat);
    const sql = fixQuery(`SELECT cms.player_id as "playerId", 
      p.name as "playerName",
      p.uuid as "playerUuid",
      cms.total_games as "gamesPlayed", 
      cms.total_hands as "handsPlayed", 
      cms.total_buyins as buyin, 
      cms.total_winnings as profit, 
      cms.rake_paid as "rakePaid" 
      FROM club_member_stat cms 
      INNER JOIN player p on p.id = cms.player_id 
      where club_id = ${clubId} ORDER BY cms.total_winnings DESC`);
    const statsResp = await getUserConnection().query(sql, []);
    return statsResp;
  }

  public async approveMember(
    ownerId: string,
    clubCode: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    const clubMember = await Cache.getClubMember(playerId, clubCode);
    if (!clubMember) {
      throw new Error('The player is not in the club');
    }

    const club = await Cache.getClub(clubCode, true);
    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    if (owner.uuid !== ownerId) {
      // TODO: make sure the ownerId is matching with club owner
      if (ownerId !== '') {
        throw new Error('Unauthorized');
      }
    }

    const clubMemberRepository = getUserRepository<ClubMember>(ClubMember);
    await clubMemberRepository
      .createQueryBuilder()
      .update()
      .set({
        status: ClubMemberStatus.ACTIVE,
      })
      .where({
        id: clubMember.id,
      })
      .execute();
    await Cache.getClubMember(playerId, clubCode, true /* update cache */);

    const messageId = uuidv4();
    try {
      const player = await Cache.getPlayer(playerId);

      // add a message in the chat
      await ClubMessageRepository.playerJoined(club, player);

      // TODO: send firebase notification
      // Nats.sendClubUpdate(
      //   clubCode,
      //   club.name,
      //   ClubUpdateType[ClubUpdateType.MEMBER_APPROVED],
      //   messageId
      // );
    } catch (err) {
      logger.error(`Failed to send NATS message. Error: ${err.toString()}`);
    }

    return ClubMemberStatus.ACTIVE;
  }

  public async rejectMember(
    ownerId: string,
    clubCode: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    const clubMember = await Cache.getClubMember(playerId, clubCode, true);
    if (!clubMember) {
      throw new Error('The player is not in the club');
    }

    const club = await Cache.getClub(clubCode, true);
    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    if (owner.uuid !== ownerId) {
      // TODO: make sure the ownerId is matching with club owner
      if (ownerId !== '') {
        throw new Error('Unauthorized');
      }
    }

    if (clubMember.status === ClubMemberStatus.DENIED) {
      return clubMember.status;
    }

    const clubMemberRepository = getUserRepository<ClubMember>(ClubMember);
    await clubMemberRepository
      .createQueryBuilder()
      .update()
      .set({
        status: ClubMemberStatus.DENIED,
      })
      .where({
        id: clubMember.id,
      })
      .execute();
    await Cache.getClubMember(playerId, clubCode, true /* update cache */);
    Firebase.clubMemberDeniedJoinRequest(club, owner, clubMember.player).catch(
      e => {
        logger.error(`Failed to send firebase message. Error: ${e.message}`);
      }
    );
    return ClubMemberStatus.DENIED;
  }

  public async kickMember(
    ownerId: string,
    clubCode: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    const clubMember = await Cache.getClubMember(playerId, clubCode);
    if (!clubMember) {
      throw new Error('The player is not in the club');
    }

    const club = await Cache.getClub(clubCode);
    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    if (owner.uuid !== ownerId) {
      // TODO: make sure the ownerId is matching with club owner
      if (ownerId !== '') {
        throw new Error('Unauthorized');
      }
    }

    // if (clubMember.status === ClubMemberStatus.KICKEDOUT) {
    //   return clubMember.status;
    // }

    const clubMemberRepository = getUserRepository<ClubMember>(ClubMember);
    await clubMemberRepository
      .createQueryBuilder()
      .update()
      .set({
        status: ClubMemberStatus.KICKEDOUT,
      })
      .where({
        id: clubMember.id,
      })
      .execute();
    await Cache.getClubMember(playerId, clubCode, true /* update cache */);

    const messageId = uuidv4();
    try {
      const player = await Cache.getPlayer(playerId);

      // add a message in the chat
      await ClubMessageRepository.playerKickedout(club, player);
    } catch (err) {
      logger.error(`Failed to send NATS message. Error: ${err.toString()}`);
    }

    return ClubMemberStatus.KICKEDOUT;
  }

  public async getClubMemberStatus(
    clubCode: string,
    playerId: string
  ): Promise<ClubMember> {
    const clubMember = await Cache.getClubMember(playerId, clubCode);
    if (!clubMember) {
      throw new Error('Club membership not found');
    }
    return clubMember;
  }

  protected async getClubMember(
    clubCode: string,
    playerId: string
  ): Promise<[Club, Player, ClubMember | undefined]> {
    const clubRepository = getUserRepository<Club>(Club);
    const playerRepository = getUserRepository<Player>(Player);

    const club = await clubRepository.findOne({where: {clubCode: clubCode}});
    const player = await playerRepository.findOne({where: {uuid: playerId}});
    if (!club) {
      throw new Error(`Club ${clubCode} is not found`);
    }

    if (!player) {
      throw new Error(`Player ${playerId} is not found`);
    }

    const clubMemberRepository = getUserRepository<ClubMember>(ClubMember);
    // see whehter the player is already a member
    const clubMember = await clubMemberRepository.findOne({
      where: {
        club: {id: club.id},
        player: {id: player.id},
      },
    });
    return [club, player, clubMember];
  }

  public async getMembers(
    clubCode: string,
    filter?: getMembersFilterData
  ): Promise<ClubMember[]> {
    const clubRepository = getUserRepository<Club>(Club);
    const club = await clubRepository.findOne({where: {clubCode: clubCode}});
    if (!club) {
      throw new Error(`Club ${clubCode} is not found`);
    }
    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    const clubMemberRepository = getUserRepository<ClubMember>(ClubMember);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      club: {id: club.id},
      status: Not(
        In([
          ClubMemberStatus.LEFT,
          ClubMemberStatus.DENIED,
          ClubMemberStatus.KICKEDOUT,
        ])
      ),
    };
    if (filter) {
      if (filter.all) {
        // nothing to filter
      } else {
        if (filter.unsettled) {
          where.balance = Not(0);
        }

        if (filter.managers) {
          where.isManager = true;
        }

        if (filter.playerId) {
          const player = await Cache.getPlayer(filter.playerId);
          where.player = {id: player.id};
        }

        if (filter.inactive) {
          const inactiveDate = new Date();
          inactiveDate.setMonth(inactiveDate.getMonth() - 3);
          where.lastGamePlayedDate = LessThan(inactiveDate);
        }
      }
    }

    // see whehter the player is already a member
    const clubMembers = await clubMemberRepository.find({
      relations: ['player'],
      where: where,
    });
    return clubMembers;
  }

  public async getClubMemberStat(clubCode: string) {
    const clubMemberStatRepo = getUserRepository(ClubMemberStat);
    const club = await Cache.getClub(clubCode);
    // see whehter the player is already a member
    const clubMemberStat = await clubMemberStatRepo.find({
      where: {clubId: club.id},
    });
    return _.keyBy(clubMemberStat, 'playerId');
  }

  public async isClubMember(
    clubCode: string,
    playerId: string
  ): Promise<ClubMember | null> {
    const playerRepository = getUserRepository<Player>(Player);
    const clubRepository = getUserRepository<Club>(Club);
    const club = await clubRepository.findOne({where: {clubCode: clubCode}});
    const player = await playerRepository.findOne({where: {uuid: playerId}});
    if (!club || !player) {
      return null;
    }

    const clubMemberRepository = getUserRepository<ClubMember>(ClubMember);
    const clubMember = await clubMemberRepository.findOne({
      where: {
        club: {id: club.id},
        player: {id: player.id},
      },
    });
    if (clubMember) {
      return clubMember;
    }
    return null;
  }

  public async getPlayerClubs(
    playerId: string
  ): Promise<Array<getPlayerClubsData>> {
    const playerRepository = getUserRepository<Player>(Player);
    const player = await playerRepository.findOne({where: {uuid: playerId}});
    if (!player) {
      throw new Error('Not found');
    }

    const query = fixQuery(`WITH my_clubs as (
      SELECT cm.club_id, count(*) member_count FROM club_member cm
      WHERE cm.club_id in (SELECT club_id FROM club_member WHERE player_id=?)
                 GROUP BY cm.club_id)
      SELECT c.club_code as "clubCode", member_count as "memberCount", c.name, p.name as "host", c.owner_id as "ownerId",
          cm.status as "memberStatus", c.status, c.pic_url as "picUrl", cm.balance balance
      FROM club c JOIN my_clubs mc ON c.id = mc.club_id
      JOIN club_member cm ON cm.club_id = c.id AND cm.player_id=?
      JOIN player p ON p.id = c.owner_id`);
    const result = await getUserConnection().query(query, [
      player.id,
      player.id,
    ]);
    return result;
  }

  public async leaveClub(
    clubCode: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    const player = await Cache.getPlayer(playerId);
    const clubMember = await Cache.getClubMember(playerId, clubCode);
    if (!clubMember) {
      throw new Error('The player is not in the club');
    }
    if (clubMember.status === ClubMemberStatus.LEFT) {
      return clubMember.status;
    }

    const club = await Cache.getClub(clubCode);
    if (clubMember.isOwner) {
      throw new Error('Player is the owner. Owner cannot leave the club');
    }

    const clubMemberRepository = getUserRepository<ClubMember>(ClubMember);
    await clubMemberRepository.update(
      {
        id: clubMember.id,
      },
      {
        status: ClubMemberStatus.LEFT,
      }
    );
    await ClubMessageRepository.playerLeft(club, player);
    return ClubMemberStatus.LEFT;
  }

  public async getClubGames(
    clubCode: string,
    playerId: number,
    completedGames?: boolean
  ): Promise<Array<getClubGamesData>> {
    let endedAt = '';
    if (completedGames) {
      endedAt = 'AND pg.ended_at IS NOT NULL';
    }

    const query = fixQuery(`
        SELECT pg.id, pg.game_code as "gameCode", pg.game_num as "gameNum",
        pgt.session_time as "sessionTime", pg.game_status as "status",
        pgt.sat_at as "satAt",
        pg.small_blind as "smallBlind", pg.big_blind as "bigBlind",
        pgt.no_hands_played as "handsPlayed", 
        pgt.no_hands_won as "handsWon",
        pg.game_type as "gameType", 
        pg.started_at as "startedAt", pg.started_by_name as "startedBy",
        pg.ended_at as "endedAt", pg.ended_by_name as "endedBy", 
        pg.started_at as "startedAt", pgt.session_time as "sessionTime", 
        (pgt.stack - pgt.buy_in) as balance 
        FROM
        poker_game pg  
        LEFT OUTER JOIN player_game_tracker pgt ON 
        pgt.pgt_game_id = pg.id AND pgt.pgt_player_id = ?
        WHERE pg.club_code = ? ${endedAt}
        ORDER BY pg.id DESC`);
    // TODO: we need to do pagination here
    const result = await getGameConnection().query(query, [playerId, clubCode]);
    return result;
  }

  public async getClubById(clubCode: string): Promise<Club | undefined> {
    const repository = getUserRepository(Club);
    // get club by id (testing only)
    const club = await repository.findOne({where: {clubCode: clubCode}});
    if (!club) {
      throw new Error('Club not found');
    }
    return club;
  }

  public async getNextGameNum(clubId: number): Promise<number> {
    const nextGameNum = await getUserManager().transaction(
      async transactionEntityManager => {
        const clubRepo = transactionEntityManager.getRepository(Club);

        await clubRepo
          .createQueryBuilder()
          .update()
          .set({
            nextGameNum: () => 'next_game_num + 1',
          })
          .where({
            id: clubId,
          })
          .execute();

        const club = await clubRepo.findOne({id: clubId});
        if (!club) {
          return 1;
        }
        return club.nextGameNum;
      }
    );

    return nextGameNum;
  }

  public async searchClub(clubCode: string): Promise<Club | null> {
    clubCode = clubCode.toLowerCase();
    try {
      const clubs = await getUserRepository(Club).find({
        where: {clubCode: clubCode},
      });
      if (clubs.length === 1) {
        const club = clubs[0];
        if (club.owner !== null) {
          await Promise.resolve(club.owner);
        }
        return club;
      }
    } catch (err) {
      logger.error(err);
    }
    return null;
  }

  public async getClubOwnerManagerCount(
    playerUuid: string
  ): Promise<[number, number, number]> {
    /*
      select cm.is_manager, cm.is_owner from club_member cm JOIN
      player p on cm.player_id = p.id where
      p.uuid = 'c2dc2c3d-13da-46cc-8c66-caa0c77459de' and (cm.is_owner or cm.is_manager);
      */
    const clubMemberRepo = getUserRepository(ClubMember);
    const player = await Cache.getPlayer(playerUuid);
    const resp = await clubMemberRepo.find({
      player: {id: player.id},
      status: ClubMemberStatus.ACTIVE,
    });
    let ownerCount = 0,
      managerCount = 0,
      memberCount = 0;
    for (const row of resp) {
      if (row.isManager) {
        managerCount++;
      }
      if (row.isOwner) {
        ownerCount++;
      }
      memberCount++;
    }
    return [memberCount, ownerCount, managerCount];
  }

  public async getPendingMemberCount(club: Club): Promise<number> {
    const clubMemberRepo = getUserRepository(ClubMember);
    const count = await clubMemberRepo.count({
      club: {id: club.id},
      status: ClubMemberStatus.PENDING,
    });
    return count;
  }

  public async broadcastMessage(club: Club, message: any) {
    await Firebase.sendClubMsg(club, message);
  }

  public async getClubIds(playerId: number): Promise<Array<number>> {
    const clubMemberRepo = getUserRepository(ClubMember);
    const resp = await clubMemberRepo
      .createQueryBuilder()
      .select('club_id', 'clubId')
      .where({
        player: {id: playerId},
      })
      .execute();
    return resp.map(x => x.clubId);
  }

  public async updatePic(clubCode: string, url: string) {
    const clubRepo = getUserRepository(Club);
    const resp = await clubRepo.update(
      {
        clubCode: clubCode,
      },
      {
        picUrl: url,
      }
    );
  }

  public async getClubMembersForFirebase(
    club: Club
  ): Promise<Array<ClubMemberFirebaseToken>> {
    const sql = `select player.id, firebase_token "firebaseToken" from player join club_member cm 
            on player.id = cm.player_id where cm.club_id = ? order by player.id`;
    const ret = new Array<ClubMemberFirebaseToken>();
    const query = fixQuery(sql);
    const resp = await getUserConnection().query(query, [club.id]);
    for (const r of resp) {
      ret.push({
        playerId: r.id,
        firebaseToken: r.firebaseToken,
      });
    }

    return ret;
  }
}

export const ClubRepository = new ClubRepositoryImpl();
