import {
  Club,
  ClubInvitations,
  ClubManagerRoles,
  ClubMember,
  CreditTracking,
} from '@src/entity/player/club';
import {
  ClubMemberStatus,
  ClubStatus,
  CreditUpdateType,
  HostMessageType,
} from '@src/entity/types';
import {Player} from '@src/entity/player/player';
import {
  Not,
  LessThan,
  MoreThan,
  In,
  UpdateResult,
  LessThanOrEqual,
  EntityManager,
  Repository,
} from 'typeorm';
import {PokerGame} from '@src/entity/game/game';
import {
  getClubGamesData,
  getMembersFilterData,
  getPlayerClubsData,
  PageOptions,
} from '@src/types';
import {errToStr, getLogger} from '@src/utils/log';
import {getClubCode, getInviteCode} from '@src/utils/uniqueid';
import {centsToChips, fixQuery} from '@src/utils';
import {Cache} from '@src/cache';
import {FirebaseToken, ClubUpdateType} from './types';
import {Nats} from '@src/nats';
import {v4 as uuidv4} from 'uuid';
import {StatsRepository} from './stats';
import {Firebase, getAppSettings} from '@src/firebase';
import {
  getGameConnection,
  getHistoryConnection,
  getHistoryRepository,
  getUserConnection,
  getUserManager,
  getUserRepository,
} from '.';
import {ClubMemberStat} from '@src/entity/player/club';
import {ClubMessageRepository} from './clubmessage';
import {AppCoinRepository} from './appcoin';
import {Errors, GenericError, UnauthorizedError} from '@src/errors';
import _ from 'lodash';
import {getRunProfile, RunProfile} from '@src/server';
import {HostMessageRepository} from './hostmessage';
import {resolveObjectURL} from 'buffer';

const logger = getLogger('repositories::club');

const MIN_CREDIT = -1000000000;
const MAX_CREDIT = 1000000000;

export interface ClubCreateInput {
  ownerUuid: string;
  name: string;
  description: string;
  invitationCode?: string;
}

export interface ClubUpdateInput {
  name: string;
  description: string;
  showHighRankStats: boolean;
  trackMemberCredit: boolean;
  picUrl: string;
  showGameResult: boolean;
}

export interface ClubMemberUpdateInput {
  isManager?: boolean;
  notes?: string;
  status?: ClubMemberStatus;
  autoBuyinApproval?: boolean;
  agentUuid?: string;
  contactInfo?: string;
  tipsBack?: number;
  isOwner?: boolean;
  isAgent?: boolean;
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

    // check whether the calling user is the owner of the club
    if (owner.uuid !== hostUuid) {
      throw new UnauthorizedError();
    }
    const callingUser = await Cache.getClubMember(hostUuid, clubCode);
    if (!callingUser) {
      throw new UnauthorizedError();
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

    const wasManager = clubMember.isManager;
    const wasOwner = clubMember.isOwner;
    const wasMainOwner = clubMember.isMainOwner;

    // update data
    if (updateData.notes) {
      clubMember.notes = updateData.notes.toString();
    }
    if (updateData.status) {
      clubMember.status = ClubMemberStatus[
        updateData.status
      ] as unknown as ClubMemberStatus;
    }
    if (updateData.isManager || updateData.isManager === false) {
      if (!callingUser.isOwner) {
        throw new UnauthorizedError();
      }
      clubMember.isManager = updateData.isManager;
    }

    if (updateData.isOwner || updateData.isOwner === false) {
      if (!callingUser.isMainOwner) {
        throw new UnauthorizedError();
      }
      clubMember.isOwner = updateData.isOwner;
    }

    if (
      updateData.autoBuyinApproval ||
      updateData.autoBuyinApproval === false
    ) {
      clubMember.autoBuyinApproval = updateData.autoBuyinApproval;
    }

    if (updateData.contactInfo) {
      clubMember.contactInfo = updateData.contactInfo.toString();
    }

    if (typeof updateData.tipsBack === 'number') {
      clubMember.tipsBack = updateData.tipsBack;
    }

    if (updateData.isAgent !== undefined) {
      // lookup the player
      clubMember.isAgent = updateData.isAgent;
    }

    if (updateData.agentUuid) {
      // lookup the player
      const referredByPlayer = await Cache.getPlayer(updateData.agentUuid);
      clubMember.agent = referredByPlayer;
    }

    // Save the data
    const resp = await clubMemberRepository.save(clubMember);
    await Cache.getClubMember(player.uuid, clubCode, true /* update cache */);
    if (updateData.isManager && !wasManager) {
      // a player is promoted as manager
      Nats.sendClubUpdate(
        clubCode,
        club.name,
        ClubUpdateType[ClubUpdateType.PROMOTED],
        uuidv4(),
        {
          playerUuid: player.uuid,
          name: player.name,
          role: 'manager',
        }
      );
    }
    if (updateData.isOwner && !wasOwner) {
      // a player is promoted as manager
      Nats.sendClubUpdate(
        clubCode,
        club.name,
        ClubUpdateType[ClubUpdateType.PROMOTED],
        uuidv4(),
        {
          playerUuid: player.uuid,
          name: player.name,
          role: 'owner',
        }
      );
    }

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
    if (typeof input.showHighRankStats === 'boolean') {
      club.showHighRankStats = input.showHighRankStats;
    }
    if (typeof input.trackMemberCredit === 'boolean') {
      club.trackMemberCredit = input.trackMemberCredit;
      if (!club.creditTrackingEnabled) {
        club.creditTrackingEnabled = true;
      }
    }
    if (typeof input.showGameResult === 'boolean') {
      club.showGameResult = input.showGameResult;
    }
    if (typeof input.picUrl === 'string') {
      club.picUrl = input.picUrl;
    }
    await clubRepository.save(club);
    await Cache.getClub(clubCode, true);

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

    let invitationRow: ClubInvitations;
    if (input.invitationCode) {
      const invitationRepo = getUserRepository(ClubInvitations);
      const ret = await invitationRepo.findOne({
        invitationCode: input.invitationCode,
      });
      if (!ret) {
        throw new Error('Invitation code is not found');
      }
      if (!ret.neverExpires) {
        if (ret.used) {
          throw new Error('Invitation is used');
        }
      }
      invitationRow = ret;
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
    clubMember.isMainOwner = true;
    clubMember.joinedDate = new Date();
    clubMember.status = ClubMemberStatus.ACTIVE;
    clubMember.lastPlayedDate = new Date();

    //logger.info('****** STARTING TRANSACTION TO SAVE club and club member');
    await getUserManager().transaction(async transactionEntityManager => {
      const clubMemberRepo =
        transactionEntityManager.getRepository<ClubMember>(ClubMember);
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
      const clubManagerRolesRepo =
        transactionEntityManager.getRepository(ClubManagerRoles);
      const role = new ClubManagerRoles();
      if (invitationRow) {
        club.invitationCode = invitationRow.invitationCode;
      }

      await clubRepo.save(club);
      role.clubId = club.id;
      await clubManagerRolesRepo.save(role);
      await clubMemberRepo.save(clubMember);

      if (clubCount === 0) {
        // if this is the first club for the user, add first time club owner coins
        let firstClubCoins = appSettings.clubHostFreeCoins;
        if (getRunProfile() == RunProfile.DEV) {
          firstClubCoins = 1000;
        }
        await AppCoinRepository.addCoins(0, firstClubCoins, ownerObj.uuid);
      }
      if (invitationRow) {
        const invitationRepo =
          transactionEntityManager.getRepository(ClubInvitations);
        if (!invitationRow.neverExpires) {
          await invitationRepo.update(
            {
              id: invitationRow.id,
            },
            {
              used: true,
            }
          );
        }
      }

      const clubMemberStatRepository =
        transactionEntityManager.getRepository(ClubMemberStat);
      const clubMemberStat = new ClubMemberStat();
      clubMemberStat.clubId = club.id;
      clubMemberStat.playerId = clubMember.player.id;
      await clubMemberStatRepository.save(clubMemberStat);
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
    clubMember.lastPlayedDate = new Date();

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
      const data = {
        playerName: player.name,
        playerUuid: player.uuid,
      };
      // TODO: send firebase notification
      Nats.sendClubUpdate(
        clubCode,
        club.name,
        ClubUpdateType[ClubUpdateType.NEW_MEMBER_REQUEST],
        messageId,
        data
      );
      const owner: Player | undefined = await Promise.resolve(club.owner);
      if (!owner) {
        throw new Error('Unexpected. There is no owner for the club');
      }
      Firebase.clubMemberJoinRequest(club, owner, player).catch(e => {
        logger.error(`Failed to send firebase message. Error: ${e.message}`);
      });
    } catch (err) {
      logger.error(`Failed to send NATS message. Error: ${errToStr(err)}`);
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
      logger.error(`Failed to send NATS message. Error: ${errToStr(err)}`);
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
    if (clubMember.isOwner) {
      throw new Error('Cannot kick out club owner from the club');
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

    try {
      const player = await Cache.getPlayer(playerId);

      // add a message in the chat
      await ClubMessageRepository.playerKickedout(club, player);
    } catch (err) {
      logger.error(`Failed to send NATS message. Error: ${errToStr(err)}`);
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
          where.availableCredit = Not(0);
        }

        if (filter.negative) {
          where.availableCredit = LessThan(0);
        }

        if (filter.positive) {
          where.availableCredit = MoreThan(0);
        }

        if (filter.inactiveFrom) {
          where.lastPlayedDate = LessThanOrEqual(filter.inactiveFrom);
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
          where.lastPlayedDate = LessThan(inactiveDate);
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
      WHERE cm.club_id in (SELECT club_id FROM club_member WHERE player_id=?) AND cm.status IN (2, 4)
                 GROUP BY cm.club_id)
      SELECT c.club_code as "clubCode", member_count as "memberCount", c.name, p.name as "host", c.owner_id as "ownerId",
          cm.status as "memberStatus", c.status, c.pic_url as "picUrl", cm.available_credit as "availableCredit"
      FROM club c JOIN my_clubs mc ON c.id = mc.club_id
      JOIN club_member cm ON cm.club_id = c.id AND cm.player_id=?
      JOIN player p ON p.id = c.owner_id
      WHERE cm.status IN (2, 4)`);
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
      return this.getCompletedGames(clubCode, playerId);
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

  public async getCompletedGames(
    clubCode: string,
    playerId: number
  ): Promise<Array<getClubGamesData>> {
    const query = fixQuery(`
        SELECT gh.game_id, gh.game_code as "gameCode", gh.game_num as "gameNum",
        pig.session_time as "sessionTime", gh.game_status as "status",
        gh.small_blind as "smallBlind", gh.big_blind as "bigBlind",
        pig.no_hands_played as "handsPlayed", 
        pig.no_hands_won as "handsWon",
        gh.game_type as "gameType", 
        gh.started_at as "startedAt", gh.started_by_name as "startedBy",
        gh.ended_at as "endedAt", gh.ended_by_name as "endedBy", 
        gh.started_at as "startedAt", pig.session_time as "sessionTime", 
        (pig.stack - pig.buy_in) as balance 
        FROM
        game_history gh  
        LEFT OUTER JOIN players_in_game pig ON 
        pig.game_id = gh.game_id and pig.player_id = ?
        WHERE gh.club_code = ? and ended_at is not null
        ORDER BY gh.game_id desc`);
    // TODO: we need to do pagination here
    const result = await getHistoryConnection().query(query, [
      playerId,
      clubCode,
    ]);
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
    // update cache
    await Cache.getClub(clubCode, true);
  }

  public async getClubMembersForFirebase(
    club: Club
  ): Promise<Array<FirebaseToken>> {
    const sql = `select player.id, firebase_token "firebaseToken" from player join club_member cm 
            on player.id = cm.player_id where firebase_token is not null and cm.club_id = ? order by player.id`;
    const ret = new Array<FirebaseToken>();
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

  public async getPlayersForFirebase(): Promise<Array<FirebaseToken>> {
    const sql = `select player.id, firebase_token "firebaseToken" from player where firebase_token is not null`;
    const ret = new Array<FirebaseToken>();
    const query = fixQuery(sql);
    const resp = await getUserConnection().query(query);
    for (const r of resp) {
      ret.push({
        playerId: r.id,
        firebaseToken: r.firebaseToken,
      });
    }

    return ret;
  }

  public async getCreditHistory(
    reqPlayerId: string,
    clubCode: string,
    playerUuid: string
  ): Promise<Array<any>> {
    const reqPlayer = await Cache.getPlayer(reqPlayerId);
    if (!reqPlayer) {
      logger.error(
        `Could not get credit history. Request player does not exist. player: ${reqPlayerId}`
      );
      throw new Error('Unauthorized');
    }

    const club = await Cache.getClub(clubCode);
    if (!club) {
      logger.error(
        `Could not get credit history. Club does not exist. club: ${clubCode}`
      );
      throw new Error('Invalid club');
    }

    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    if (reqPlayer.uuid !== playerUuid && reqPlayer.uuid !== owner.uuid) {
      logger.error(
        `Credit history requested by unauthorized player. Request player: ${reqPlayer.uuid}, club: ${clubCode}, player: ${playerUuid}`
      );
      throw new Error('Unauthorized');
    }

    const player = await Cache.getPlayer(playerUuid);
    if (!player) {
      logger.error(
        `Could not get credit history. Player does not exist. player: ${playerUuid}`
      );
      throw new Error('Invalid player');
    }

    const clubMember = await Cache.getClubMember(playerUuid, clubCode);
    if (!clubMember) {
      logger.error(
        `Could not get credit history. Player is not a club member. player: ${playerUuid}, club: ${clubCode}`
      );
      throw new Error('Invalid player');
    }

    if (!club.trackMemberCredit) {
      return [];
    }

    const creditTrackingRepo =
      getUserRepository<CreditTracking>(CreditTracking);
    const res: Array<any> = await creditTrackingRepo.find({
      where: {
        clubId: club.id,
        playerId: player.id,
      },
      order: {
        id: 'DESC',
      },
      take: 100,
    });

    for (const r of res) {
      r.updateType = CreditUpdateType[r.updateType];
      r.updateDate = r.createdAt.toISOString();
    }

    return res;
  }

  public async clubMemberActivityGrouped(
    playerId: string,
    clubCode: string,
    startDate: Date,
    endDate: Date
  ) {
    const reqPlayer = await Cache.getPlayer(playerId);
    if (!reqPlayer) {
      logger.error(
        `Could not get aggregated member activity. Request player does not exist. player: ${playerId}`
      );
      throw new Error('Unauthorized');
    }

    const club = await Cache.getClub(clubCode);
    if (!club) {
      logger.error(
        `Could not get aggregated member activity. Club does not exist. club: ${clubCode}`
      );
      throw new Error('Invalid club');
    }

    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    if (reqPlayer.uuid !== owner.uuid) {
      logger.error(
        `Aggregated member activity requested by unauthorized player. Request player: ${reqPlayer.uuid}, club: ${clubCode}`
      );
      throw new Error('Unauthorized');
    }

    const query = fixQuery(`
        SELECT cm.player_id AS "playerId", cm.available_credit AS "availableCredit",
            cm.tips_back AS "tipsBack", cm.last_played_date AS "lastPlayedDate",
            p.uuid AS "playerUuid", p.name AS "playerName", aggtips.tips AS "tips"
        FROM club_member cm
        INNER JOIN player p ON cm.player_id = p.id
        JOIN (
            SELECT player_id, sum(tips) AS tips FROM credit_tracking ct
            WHERE club_id = ?
            AND "createdAt" >= ?
            AND "createdAt" < (?::timestamp + INTERVAL '1 day')
            AND tips IS NOT NULL
            GROUP BY player_id
        ) aggtips ON cm.player_id = aggtips.player_id
        WHERE cm.club_id = ?;
    `);
    const dbResult = await getUserConnection().query(query, [
      club.id,
      startDate,
      endDate,
      club.id,
    ]);

    const res: Array<any> = [];
    for (const row of dbResult) {
      const activity = {...row};
      if (activity.credits === null || activity.credits === undefined) {
        activity.credits = 0;
      }
      if (activity.tips === null || activity.tips === undefined) {
        activity.tips = 0;
      }
      if (activity.tipsBack === null || activity.tipsBack === undefined) {
        activity.tipsBack = 0;
      }
      activity.tipsBackAmount = activity.tips * activity.tipsBack * 0.01;
      activity.lastPlayedDate = activity.lastPlayedDate?.toISOString();
      res.push(activity);
    }

    const playersActivity = _.keyBy(res, 'playerId');
    for (const key of Object.keys(playersActivity)) {
      playersActivity[key].buyIn = 0;
      playersActivity[key].profit = 0;
      playersActivity[key].gamesPlayed = 0;
    }

    // get buyin and profit data from players_in_game
    const buyInQuery = fixQuery(`
        select player_id "playerId", count(*) "gamesPlayed", sum(buy_in) "buyIn", sum(stack) - sum(buy_in) profit, 
          sum(rake_paid) from players_in_game pig join game_history gh ON 
            pig.game_id = gh.game_id  
        where gh.club_code  = ? and 
            gh.ended_at > ? and 
            gh.ended_at < ?
        group by pig.player_id`);
    const buyInResult = await getHistoryConnection().query(buyInQuery, [
      club.clubCode,
      startDate,
      endDate,
    ]);
    for (const row of buyInResult) {
      playersActivity[row.playerId].buyIn = row.buyIn;
      playersActivity[row.playerId].profit = row.profit;
      playersActivity[row.playerId].gamesPlayed = row.gamesPlayed;
    }
    return res;
  }

  public async agentPlayersActivity(
    agentId: string,
    clubCode: string,
    startDate: Date,
    endDate: Date
  ) {
    const reqPlayer = await Cache.getPlayer(agentId);
    if (!reqPlayer) {
      logger.error(
        `Could not get aggregated member activity. Request player does not exist. player: ${agentId}`
      );
      throw new Error('Unauthorized');
    }

    const club = await Cache.getClub(clubCode);
    if (!club) {
      logger.error(
        `Could not get aggregated member activity. Club does not exist. club: ${clubCode}`
      );
      throw new Error('Invalid club');
    }

    const clubMember = await Cache.getClubMember(agentId, clubCode, true);
    if (!clubMember) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    const query = fixQuery(`
    SELECT cm.player_id AS "playerId", cm.available_credit AS "availableCredit",
    cm.tips_back AS "tipsBack", cm.last_played_date AS "lastPlayedDate",
    p.uuid AS "playerUuid", p.name AS "playerName", 
    aggtips.tips AS "tips", aggtips.buyin AS "buyIn", aggtips.profit AS "profit", aggtips.hands_played AS "handsPlayed"
      FROM club_member cm
      INNER JOIN player p ON cm.player_id = p.id
      JOIN (
        SELECT mtt.player_id, sum(number_of_hands_played) hands_played, sum(tips_paid) as tips, 
              sum(buyin) as buyin, sum(profit) as profit from member_tips_tracking mtt 
        WHERE mtt.club_id = ? AND game_ended_datetime >= ? AND game_ended_datetime <= (?::timestamp + INTERVAL '1 day')
              AND mtt.player_id IN 
              (SELECT cm.player_id FROM club_member cm WHERE cm.agent_id=?)
        GROUP BY player_id) 
      as aggtips on aggtips.player_id = p.id
    `);
    const dbResult = await getUserConnection().query(query, [
      club.id,
      startDate,
      endDate,
      reqPlayer.id,
    ]);

    const res: Array<any> = [];
    for (const row of dbResult) {
      const activity = {...row};
      activity.gamesPlayed = 0;
      if (activity.credits === null || activity.credits === undefined) {
        activity.credits = 0;
      }
      if (activity.tips === null || activity.tips === undefined) {
        activity.tips = 0;
      }
      if (activity.tipsBack === null || activity.tipsBack === undefined) {
        activity.tipsBack = 0;
      }
      activity.tipsBackAmount = activity.tips * activity.tipsBack * 0.01;
      activity.lastPlayedDate = activity.lastPlayedDate?.toISOString();
      res.push(activity);
    }

    // const playersActivity = _.keyBy(res, 'playerId');
    // for (const key of Object.keys(playersActivity)) {
    //   playersActivity[key].buyIn = 0;
    //   playersActivity[key].profit = 0;
    //   playersActivity[key].gamesPlayed = 0;
    // }

    // // get buyin and profit data from players_in_game
    // const buyInQuery = fixQuery(`
    //     select player_id "playerId", count(*) "gamesPlayed", sum(buy_in) "buyIn", sum(stack) - sum(buy_in) profit,
    //       sum(rake_paid) from players_in_game pig join game_history gh ON
    //         pig.game_id = gh.game_id
    //     where gh.club_code  = ? and
    //         gh.ended_at > ? and
    //         gh.ended_at < ?
    //     group by pig.player_id`);
    // const buyInResult = await getHistoryConnection().query(buyInQuery, [
    //   club.clubCode,
    //   startDate,
    //   endDate,
    // ]);
    // for (const row of buyInResult) {
    //   playersActivity[row.playerId].buyIn = row.buyIn;
    //   playersActivity[row.playerId].profit = row.profit;
    //   playersActivity[row.playerId].gamesPlayed = row.gamesPlayed;
    // }
    return res;
  }
  public async adminSetCredit(
    reqPlayerId: string,
    clubCode: string,
    playerUuid: string,
    amount: number,
    notes: string,
    followup: boolean
  ): Promise<boolean> {
    const reqPlayer = await Cache.getPlayer(reqPlayerId);
    if (!reqPlayer) {
      logger.error(
        `Could not set credit. Request player does not exist. player: ${reqPlayerId}`
      );
      throw new Error('Unauthorized');
    }

    const club = await Cache.getClub(clubCode);
    if (!club) {
      logger.error(
        `Could not set credit. Club does not exist. club: ${clubCode}`
      );
      throw new Error('Invalid club');
    }

    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    // check whether requesting player id is owner or manager
    const clubMember = await Cache.getClubMember(reqPlayerId, clubCode);
    if (!clubMember) {
      logger.error(
        `Could not set credit. Player is not a club member. player: ${playerUuid}, club: ${clubCode}`
      );
      throw new Error('Invalid player');
    }

    if (!clubMember.isOwner) {
      let authorized = false;
      if (clubMember.isManager) {
        const role = await ClubRepository.getManagerRole(clubCode);
        if (role) {
          if (role.canUpdateCredits) {
            authorized = true;
          }
        }
      }

      if (!authorized) {
        logger.error(
          `Set credit requested by unauthorized user. Request player: ${reqPlayer.uuid}, club: ${clubCode}, player: ${playerUuid}`
        );
        throw new Error('Unauthorized');
      }
    }

    const player = await Cache.getPlayer(playerUuid);
    if (!player) {
      logger.error(
        `Could not set credit. Player does not exist. player: ${playerUuid}`
      );
      throw new Error('Invalid player');
    }

    if (!club.trackMemberCredit) {
      logger.error(
        `Could not set credit. Member credit tracking is not enabled. Request player: ${reqPlayer.uuid}, club: ${clubCode}, player: ${playerUuid}`
      );
      throw new Error('Credit tracking not enabled');
    }

    await this.setCreditAndTracker(
      player,
      clubCode,
      amount,
      reqPlayer,
      notes,
      CreditUpdateType.CHANGE,
      followup
    );

    return true;
  }

  public async adminDeductCredit(
    reqPlayerId: string,
    clubCode: string,
    playerUuid: string,
    amount: number,
    notes: string,
    followup: boolean
  ): Promise<boolean> {
    const reqPlayer = await Cache.getPlayer(reqPlayerId);
    if (!reqPlayer) {
      logger.error(
        `Could not set credit. Request player does not exist. player: ${reqPlayerId}`
      );
      throw new Error('Unauthorized');
    }

    const club = await Cache.getClub(clubCode);
    if (!club) {
      logger.error(
        `Could not set credit. Club does not exist. club: ${clubCode}`
      );
      throw new Error('Invalid club');
    }
    const clubMember = await Cache.getClubMember(reqPlayerId, clubCode);
    if (!clubMember) {
      logger.error(
        `Could not set credit. Player is not a club member. player: ${playerUuid}, club: ${clubCode}`
      );
      throw new Error('Invalid player');
    }

    if (!clubMember.isOwner) {
      let authorized = false;
      if (clubMember.isManager) {
        const role = await ClubRepository.getManagerRole(clubCode);
        if (role) {
          if (role.canUpdateCredits) {
            authorized = true;
          }
        }
      }

      if (!authorized) {
        logger.error(
          `Set credit requested by unauthorized user. Request player: ${reqPlayer.uuid}, club: ${clubCode}, player: ${playerUuid}`
        );
        throw new Error('Unauthorized');
      }
    }
    const player = await Cache.getPlayer(playerUuid);
    if (!player) {
      logger.error(
        `Could not set credit. Player does not exist. player: ${playerUuid}`
      );
      throw new Error('Invalid player');
    }

    if (!club.trackMemberCredit) {
      logger.error(
        `Could not set credit. Member credit tracking is not enabled. Request player: ${reqPlayer.uuid}, club: ${clubCode}, player: ${playerUuid}`
      );
      throw new Error('Credit tracking not enabled');
    }

    await this.setCreditAndTracker(
      player,
      clubCode,
      amount,
      reqPlayer,
      notes,
      CreditUpdateType.DEDUCT,
      followup
    );

    return true;
  }

  public async adminAddCredit(
    reqPlayerId: string,
    clubCode: string,
    playerUuid: string,
    amount: number,
    notes: string,
    followup: boolean
  ): Promise<boolean> {
    const reqPlayer = await Cache.getPlayer(reqPlayerId);
    if (!reqPlayer) {
      logger.error(
        `Could not set credit. Request player does not exist. player: ${reqPlayerId}`
      );
      throw new Error('Unauthorized');
    }

    const club = await Cache.getClub(clubCode);
    if (!club) {
      logger.error(
        `Could not set credit. Club does not exist. club: ${clubCode}`
      );
      throw new Error('Invalid club');
    }
    const clubMember = await Cache.getClubMember(reqPlayerId, clubCode);
    if (!clubMember) {
      logger.error(
        `Could not set credit. Player is not a club member. player: ${playerUuid}, club: ${clubCode}`
      );
      throw new Error('Invalid player');
    }

    if (!clubMember.isOwner) {
      let authorized = false;
      if (clubMember.isManager) {
        const role = await ClubRepository.getManagerRole(clubCode);
        if (role) {
          if (role.canUpdateCredits) {
            authorized = true;
          }
        }
      }

      if (!authorized) {
        logger.error(
          `Set credit requested by unauthorized user. Request player: ${reqPlayer.uuid}, club: ${clubCode}, player: ${playerUuid}`
        );
        throw new Error('Unauthorized');
      }
    }
    const player = await Cache.getPlayer(playerUuid);
    if (!player) {
      logger.error(
        `Could not set credit. Player does not exist. player: ${playerUuid}`
      );
      throw new Error('Invalid player');
    }

    if (!club.trackMemberCredit) {
      logger.error(
        `Could not set credit. Member credit tracking is not enabled. Request player: ${reqPlayer.uuid}, club: ${clubCode}, player: ${playerUuid}`
      );
      throw new Error('Credit tracking not enabled');
    }

    await this.setCreditAndTracker(
      player,
      clubCode,
      amount,
      reqPlayer,
      notes,
      CreditUpdateType.ADD,
      followup
    );

    return true;
  }
  public async setCreditAndTracker(
    player: Player,
    clubCode: string,
    amount: number,
    admin: Player,
    notes: string,
    creditType: CreditUpdateType,
    followup: boolean
  ) {
    let newCredit = 0;
    const club = await Cache.getClub(clubCode);
    const changeAmount = centsToChips(amount);

    await getUserManager().transaction(async transManager => {
      if (creditType === CreditUpdateType.CHANGE) {
        await this.setCredit(
          transManager,
          admin,
          player.uuid,
          clubCode,
          amount
        );
        newCredit = amount;
        //amount = 0;
      }
      if (creditType === CreditUpdateType.ADD) {
        newCredit = await this.addCredit(
          transManager,
          admin,
          player.uuid,
          clubCode,
          amount
        );
      }
      if (creditType === CreditUpdateType.DEDUCT) {
        newCredit = await this.deductCredit(
          transManager,
          admin,
          player.uuid,
          clubCode,
          amount
        );
      }

      const club = await Cache.getClub(clubCode);
      await this.addCreditTracker(
        transManager,
        player.id,
        club.id,
        amount,
        newCredit,
        creditType,
        followup,
        undefined,
        admin,
        notes
      );
    });

    await Cache.getClubMember(player.uuid, clubCode, true);
    let clubMember = await Cache.getClubMember(player.uuid, clubCode, true);
    if (clubMember) {
      const availableCreditsCents = centsToChips(clubMember.availableCredit);

      let message: string = '';
      if (creditType === CreditUpdateType.CHANGE) {
        message = `Set Credits ${changeAmount}\n${notes}\nAvailable Credits: ${availableCreditsCents}`;
      } else if (creditType === CreditUpdateType.ADD) {
        message = `Change +${changeAmount}\n${notes}\nAvailable Credits: ${availableCreditsCents}`;
      } else if (creditType === CreditUpdateType.DEDUCT) {
        message = `Change -${changeAmount}\n${notes}\nAvailable Credits: ${availableCreditsCents}`;
      }
      // add a message in host->member message
      await HostMessageRepository.sendHostMessage(
        club,
        clubMember,
        message,
        HostMessageType.FROM_HOST
      );
      const messageId = uuidv4();
      // // send a NATS message to player
      Nats.sendCreditMessage(club.name, clubMember.player, message, messageId);
    }
  }

  public async setCredit(
    transManager: EntityManager,
    admin: Player,
    playerUuid: string,
    clubCode: string,
    newCredit: number
  ): Promise<void> {
    if (newCredit < MIN_CREDIT || newCredit > MAX_CREDIT) {
      logger.error(
        `Could not set credit. Amount exceeds limit. Admin uuid: ${admin.uuid}, club: ${clubCode}, newCredit: ${newCredit}`
      );
      throw new Error('Invalid amount');
    }
    const club = await Cache.getClub(clubCode);

    let clubMember = await Cache.getClubMember(playerUuid, clubCode);
    if (!clubMember) {
      throw new Error(
        `Could not find club member. Player: ${playerUuid}, club: ${clubCode}`
      );
    }
    const updateResult = await transManager
      .createQueryBuilder()
      .update(ClubMember)
      .set({
        availableCredit: newCredit,
      })
      .where({
        id: clubMember.id,
      })
      .execute();

    if (updateResult.affected === 0) {
      logger.error(
        `Could not set club member credit. Club member does not exist. club: ${clubCode}, member ID: ${clubMember.id}`
      );
      throw new Error('Invalid player');
    }
  }

  public async addCredit(
    transManager: EntityManager,
    admin: Player,
    playerUuid: string,
    clubCode: string,
    addCredit: number
  ): Promise<number> {
    if (addCredit < MIN_CREDIT || addCredit > MAX_CREDIT) {
      logger.error(
        `Could not set credit. Amount exceeds limit. Admin uuid: ${admin.uuid}, club: ${clubCode}, newCredit: ${addCredit}`
      );
      throw new Error('Invalid amount');
    }

    const clubMember = await Cache.getClubMember(playerUuid, clubCode);
    if (!clubMember) {
      throw new Error(
        `Could not find club member. Player: ${playerUuid}, club: ${clubCode}`
      );
    }
    const updateResult = await transManager
      .createQueryBuilder()
      .update(ClubMember)
      .set({
        availableCredit: () => `available_credit + ${addCredit}`,
      })
      .where({
        id: clubMember.id,
      })
      .execute();

    if (updateResult.affected === 0) {
      logger.error(
        `Could not set club member credit. Club member does not exist. club: ${clubCode}, member ID: ${clubMember.id}`
      );
      throw new Error('Invalid player');
    }

    // get member using transaction
    const memberRepo = transManager.getRepository(ClubMember);
    const member = await memberRepo.findOne({
      id: clubMember.id,
    });

    if (!member) {
      logger.error(
        `Could not set club member credit. Club member does not exist. club: ${clubCode}, member ID: ${clubMember.id}`
      );
      throw new Error('Invalid player');
    }
    return member.availableCredit;
  }

  public async deductCredit(
    transManager: EntityManager,
    admin: Player,
    playerUuid: string,
    clubCode: string,
    deductCredit: number
  ): Promise<number> {
    if (deductCredit < MIN_CREDIT || deductCredit > MAX_CREDIT) {
      logger.error(
        `Could not set credit. Amount exceeds limit. Admin uuid: ${admin.uuid}, club: ${clubCode}, newCredit: ${deductCredit}`
      );
      throw new Error('Invalid amount');
    }

    const clubMember = await Cache.getClubMember(playerUuid, clubCode);
    if (!clubMember) {
      throw new Error(
        `Could not find club member. Player: ${playerUuid}, club: ${clubCode}`
      );
    }
    const updateResult = await transManager
      .createQueryBuilder()
      .update(ClubMember)
      .set({
        availableCredit: () => `available_credit - ${deductCredit}`,
      })
      .where({
        id: clubMember.id,
      })
      .execute();

    if (updateResult.affected === 0) {
      logger.error(
        `Could not set club member credit. Club member does not exist. club: ${clubCode}, member ID: ${clubMember.id}`
      );
      throw new Error('Invalid player');
    }

    // get member using transaction
    const memberRepo = transManager.getRepository(ClubMember);
    const member = await memberRepo.findOne({
      id: clubMember.id,
    });
    if (!member) {
      logger.error(
        `Could not set club member credit. Club member does not exist. club: ${clubCode}, member ID: ${clubMember.id}`
      );
      throw new Error('Invalid player');
    }
    return member.availableCredit;
  }

  public async updateCreditAndTracker(
    player: Player,
    clubCode: string,
    amount: number,
    updateType: CreditUpdateType,
    gameCode: string
  ): Promise<number> {
    const credits = await getUserManager().transaction(async transManager => {
      const newCredit = await ClubRepository.updateCredit(
        player.uuid,
        clubCode,
        amount,
        transManager
      );
      const club = await Cache.getClub(clubCode);
      await this.addCreditTracker(
        transManager,
        player.id,
        club.id,
        amount,
        newCredit,
        updateType,
        undefined,
        gameCode,
        undefined,
        undefined
      );
      return newCredit;
    });
    return credits;
  }

  public async updateCredit(
    playerUuid: string,
    clubCode: string,
    amount: number,
    entityManager?: EntityManager
  ): Promise<number> {
    let clubMemberRepo: Repository<ClubMember>;
    if (entityManager) {
      clubMemberRepo = entityManager.getRepository(ClubMember);
    } else {
      clubMemberRepo = getUserConnection().getRepository(ClubMember);
    }
    const clubMember = await Cache.getClubMember(playerUuid, clubCode);
    if (!clubMember) {
      throw new Error(
        `Could not find club member. Player: ${playerUuid}, club: ${clubCode}`
      );
    }
    const memberId = clubMember.id;
    let updateResult: UpdateResult;
    let newCredit: number | undefined = undefined;
    if (process.env.DB_USED === 'sqllite') {
      // RETURNING not supported in sqlite.
      newCredit = clubMember.availableCredit + amount;
      updateResult = await clubMemberRepo.update(
        {
          id: memberId,
        },
        {
          availableCredit: newCredit,
        }
      );
    } else {
      updateResult = await clubMemberRepo
        .createQueryBuilder()
        .update()
        .set({
          availableCredit: () => `available_credit + :amount`,
        })
        .setParameter('amount', amount)
        .where({
          id: memberId,
        })
        .returning(['availableCredit'])
        .execute();

      if (updateResult.raw.length > 0) {
        newCredit = updateResult.raw[0].available_credit;
      }
    }

    if (updateResult.affected === 0) {
      throw new Error(`Could not find club member with ID ${memberId}`);
    }

    if (newCredit === null || newCredit === undefined) {
      // Shouldn't get here. Just guarding against future changes to the column name.
      const errMsg = 'Could not capture the updated club member credit';
      logger.error(errMsg);
      if (
        getRunProfile() === RunProfile.TEST ||
        getRunProfile() === RunProfile.INT_TEST
      ) {
        throw new Error(errMsg);
      }
    }

    // get member using transaction
    const member = await clubMemberRepo.findOne({
      id: clubMember.id,
    });
    if (!member) {
      throw new Error(
        `Could not find club member. Player: ${playerUuid}, club: ${clubCode}`
      );
    }
    return newCredit || member.availableCredit + amount;
  }

  public async addCreditTracker(
    transManager: EntityManager,
    playerId: number,
    clubId: number,
    amount: number,
    newCredit: number,
    updateType: CreditUpdateType,
    followup?: boolean,
    gameCode?: string,
    admin?: Player,
    notes?: string
  ) {
    const ct: CreditTracking = new CreditTracking();
    ct.clubId = clubId;
    ct.playerId = playerId;
    ct.amount = amount;
    ct.updatedCredits = newCredit;
    ct.updateType = updateType;

    if (
      updateType === CreditUpdateType.CHANGE ||
      updateType === CreditUpdateType.ADD ||
      updateType === CreditUpdateType.DEDUCT
    ) {
      if (!admin) {
        throw new Error(
          `adminUuid is required for CreditUpdateType ${CreditUpdateType[updateType]}`
        );
      }
      ct.adminName = admin.name;
      if (!notes) {
        notes = '';
      }
      ct.notes = notes;
    } else {
      if (!gameCode) {
        throw new Error(
          `gameCode is required for CreditUpdateType ${CreditUpdateType[updateType]}`
        );
      }
      ct.gameCode = gameCode;
    }

    if (followup === undefined) {
      followup = false;
    }
    ct.followup = followup;
    await transManager.getRepository(CreditTracking).save(ct);

    if (followup) {
      // update the club member table
      await transManager
        .createQueryBuilder()
        .update(ClubMember)
        .set({
          followup: followup,
        })
        .where({
          player: {id: playerId},
          club: {id: clubId},
        })
        .execute();
    }
  }

  public async getManagerRole(clubCode: string) {
    const club = await Cache.getClub(clubCode);
    const clubManagerRolesRepo = getUserRepository(ClubManagerRoles);
    let roleObj = await clubManagerRolesRepo.findOne({
      clubId: club.id,
    });
    if (roleObj) {
      return roleObj;
    }
    roleObj = new ClubManagerRoles();
    roleObj.clubId = club.id;
    await clubManagerRolesRepo.save(roleObj);
    return roleObj;
  }

  public async updateManagerRole(clubCode: string, role: any) {
    const club = await Cache.getClub(clubCode);
    const clubManagerRolesRepo = getUserRepository(ClubManagerRoles);
    let roleObj = await clubManagerRolesRepo.findOne({
      clubId: club.id,
    });
    if (!roleObj) {
      roleObj = new ClubManagerRoles();
      roleObj.clubId = club.id;
    }
    if (role.approveBuyin !== undefined) {
      roleObj.approveBuyin = role.approveBuyin;
    }
    if (role.approveMembers !== undefined) {
      roleObj.approveMembers = role.approveMembers;
    }
    if (role.canUpdateCredits !== undefined) {
      roleObj.canUpdateCredits = role.canUpdateCredits;
    }
    if (role.hostGames !== undefined) {
      roleObj.hostGames = role.hostGames;
    }
    if (role.makeAnnouncement !== undefined) {
      roleObj.makeAnnouncement = role.makeAnnouncement;
    }
    if (role.seeTips !== undefined) {
      roleObj.seeTips = role.seeTips;
    }
    if (role.sendPrivateMessage !== undefined) {
      roleObj.sendPrivateMessage = role.sendPrivateMessage;
    }
    if (role.viewMemberActivities !== undefined) {
      roleObj.viewMemberActivities = role.viewMemberActivities;
    }
    await clubManagerRolesRepo.save(roleObj);
  }

  public async createInviteCode(): Promise<string> {
    const code = await getInviteCode();
    const clubInviteRepo = getUserRepository(ClubInvitations);
    const clubInvite = new ClubInvitations();
    clubInvite.invitationCode = code;
    await clubInviteRepo.save(clubInvite);
    return code;
  }

  public async checkInvitation(code: string): Promise<any> {
    code = code.toLowerCase();
    const clubInviteRepo = getUserRepository(ClubInvitations);
    const ret = await clubInviteRepo.findOne({
      invitationCode: code,
    });
    if (!ret) {
      return {
        code: code,
        valid: false,
        used: false,
      };
    } else {
      let used = ret.used;
      if (ret.neverExpires) {
        used = false;
      }
      return {
        code: code,
        valid: true,
        used: used,
      };
    }
  }

  public async clearFollowup(
    reqPlayerId: string,
    clubCode: string,
    playerUuid: string,
    transId: number
  ): Promise<boolean> {
    const reqPlayer = await Cache.getPlayer(reqPlayerId);
    if (!reqPlayer) {
      logger.error(
        `Could not set credit. Request player does not exist. player: ${reqPlayerId}`
      );
      throw new Error('Unauthorized');
    }

    const club = await Cache.getClub(clubCode);
    if (!club) {
      logger.error(
        `Could not set credit. Club does not exist. club: ${clubCode}`
      );
      throw new Error('Invalid club');
    }

    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    if (reqPlayer.uuid !== owner.uuid) {
      logger.error(
        `Clear followup requested by unauthorized user. Request player: ${reqPlayer.uuid}, club: ${clubCode}, player: ${playerUuid}`
      );
      throw new Error('Unauthorized');
    }

    const player = await Cache.getPlayer(playerUuid);
    if (!player) {
      logger.error(
        `Could not clear followup flag. Player does not exist. player: ${playerUuid}`
      );
      throw new Error('Invalid player');
    }

    const clubMember = await Cache.getClubMember(playerUuid, clubCode);
    if (!clubMember) {
      logger.error(
        `Could not clear followup flag. Player is not a club member. player: ${playerUuid}, club: ${clubCode}`
      );
      throw new Error('Invalid player');
    }

    if (!club.trackMemberCredit) {
      logger.error(
        `Could not clear followup flag. Member credit tracking is not enabled. Request player: ${reqPlayer.uuid}, club: ${clubCode}, player: ${playerUuid}`
      );
      throw new Error('Credit tracking not enabled');
    }

    await getUserManager().transaction(async transactionEntityManager => {
      const creditTrackingRepo =
        transactionEntityManager.getRepository(CreditTracking);
      const res = await creditTrackingRepo.findOne({
        clubId: club.id,
        playerId: player.id,
        id: transId,
      });

      if (res) {
        // if found the record clear the flag
        await creditTrackingRepo.update(
          {
            clubId: club.id,
            playerId: player.id,
            id: transId,
          },
          {
            followup: false,
          }
        );

        // if all followup flags are cleared, then clear the flag in club_member table
        let query =
          'SELECT bool_or(followup) as followup FROM credit_tracking WHERE club_id=? AND player_id=?';
        query = fixQuery(query);
        const result = await transactionEntityManager.query(query, [
          club.id,
          player.id,
        ]);

        if (!result[0]['followup']) {
          await transactionEntityManager.getRepository(ClubMember).update(
            {
              club: {id: club.id},
              player: {id: player.id},
            },
            {
              followup: false,
            }
          );
        }
      }
    });
    return true;
  }

  public async clearAllFollowups(
    reqPlayerId: string,
    clubCode: string,
    playerUuid: string
  ): Promise<boolean> {
    const reqPlayer = await Cache.getPlayer(reqPlayerId);
    if (!reqPlayer) {
      logger.error(
        `Could not set credit. Request player does not exist. player: ${reqPlayerId}`
      );
      throw new Error('Unauthorized');
    }

    const club = await Cache.getClub(clubCode);
    if (!club) {
      logger.error(
        `Could not set credit. Club does not exist. club: ${clubCode}`
      );
      throw new Error('Invalid club');
    }

    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    if (reqPlayer.uuid !== owner.uuid) {
      logger.error(
        `Clear followup requested by unauthorized user. Request player: ${reqPlayer.uuid}, club: ${clubCode}, player: ${playerUuid}`
      );
      throw new Error('Unauthorized');
    }

    const player = await Cache.getPlayer(playerUuid);
    if (!player) {
      logger.error(
        `Could not clear followup flag. Player does not exist. player: ${playerUuid}`
      );
      throw new Error('Invalid player');
    }

    const clubMember = await Cache.getClubMember(playerUuid, clubCode);
    if (!clubMember) {
      logger.error(
        `Could not clear followup flag. Player is not a club member. player: ${playerUuid}, club: ${clubCode}`
      );
      throw new Error('Invalid player');
    }

    if (!club.trackMemberCredit) {
      logger.error(
        `Could not clear followup flag. Member credit tracking is not enabled. Request player: ${reqPlayer.uuid}, club: ${clubCode}, player: ${playerUuid}`
      );
      throw new Error('Credit tracking not enabled');
    }

    await getUserManager().transaction(async transactionEntityManager => {
      const creditTrackingRepo =
        transactionEntityManager.getRepository(CreditTracking);
      await creditTrackingRepo.update(
        {
          clubId: club.id,
          playerId: player.id,
        },
        {
          followup: false,
        }
      );
      await transactionEntityManager.getRepository(ClubMember).update(
        {
          club: {id: club.id},
          player: {id: player.id},
        },
        {
          followup: false,
        }
      );
    });
    return true;
  }
}

export const ClubRepository = new ClubRepositoryImpl();
