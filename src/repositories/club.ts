import {Club, ClubMember} from '@src/entity/club';
import {ClubMemberStatus, ClubStatus} from '@src/entity/types';
import {Player} from '@src/entity/player';
import {
  getConnection,
  getRepository,
  getManager,
  Not,
  LessThan,
  MoreThan,
  In,
} from 'typeorm';
import {PokerGame} from '@src/entity/game';
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

const logger = getLogger('club-repository');

export interface ClubCreateInput {
  ownerUuid: string;
  name: string;
  description: string;
}

export interface ClubUpdateInput {
  name: string;
  description: string;
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
    const clubRepository = getRepository<Club>(Club);
    const playerRepository = getRepository<Player>(Player);
    const clubMemberRepository = getRepository<ClubMember>(ClubMember);

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
    const clubRepository = getRepository(Club);
    const club = await clubRepository.findOne({where: {clubCode: clubCode}});
    return club;
  }

  public async updateClub(
    clubCode: string,
    input: ClubUpdateInput,
    club?: Club
  ): Promise<boolean> {
    const clubRepository = getRepository(Club);

    if (!club) {
      club = await clubRepository.findOne({where: {clubCode: clubCode}});
      if (!club) {
        throw new Error(`Club ${clubCode} is not found`);
      }
    }

    if (input.name) {
      club.name = input.name;
    }
    if (input.name) {
      club.name = input.name;
    }
    clubRepository.save(club);
    return true;
  }

  public async getClubCount(): Promise<number> {
    const clubRepository = getRepository(Club);
    return clubRepository.count();
  }

  public async createClub(input: ClubCreateInput): Promise<string> {
    // whoever creates this club is the owner of the club
    let clubCode = '';
    const clubRepository = getRepository(Club);

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
    const playerRepository = getRepository<Player>(Player);
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

    //logger.info('****** STARTING TRANSACTION TO SAVE club and club member');
    await getManager().transaction(async transactionEntityManager => {
      await transactionEntityManager.getRepository(Club).save(club);
      await transactionEntityManager
        .getRepository<ClubMember>(ClubMember)
        .save(clubMember);
    });
    //logger.info('****** ENDING TRANSACTION  SAVE club and club member');

    return club.clubCode;
  }

  public async deleteClub(clubCode: string) {
    const clubRepository = getRepository(Club);
    const club = await clubRepository.findOne({where: {clubCode: clubCode}});
    if (!club) {
      throw new Error(`Club: ${clubCode} does not exist`);
    }
    // we won't delete the club
    // we will simply defunct the club
    club.status = ClubStatus.DEFUNCT;
    clubRepository.save(club);
  }

  // This is an internal API
  public async deleteClubByName(clubName: string) {
    const clubRepository = getRepository(Club);
    const club = await clubRepository.findOne({where: {name: clubName}});
    if (club) {
      logger.info('****** STARTING TRANSACTION TO delete club');
      await getManager().transaction(async transactionEntityManager => {
        await transactionEntityManager
          .createQueryBuilder()
          .delete()
          .from(ClubMember)
          .where('club_id = :id', {id: club.id})
          .execute();
        transactionEntityManager.getRepository(Club).delete(club);
      });
      logger.info('****** ENDING TRANSACTION TO delete club');
    }
  }

  public async isClubOwner(clubCode: string, playerId: string) {
    const clubRepository = getRepository(Club);
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
    let clubMember = await Cache.getClubMember(playerId, clubCode);
    const player = await Cache.getPlayer(playerId);
    if (clubMember) {
      if (player.bot) {
        clubMember.status = ClubMemberStatus.ACTIVE;
        const clubMemberRepository = getRepository<ClubMember>(ClubMember);
        clubMemberRepository.update(
          {
            id: clubMember.id,
          },
          {
            status: ClubMemberStatus.ACTIVE,
          }
        );
      }
      return clubMember.status;
    }

    // create a new membership
    clubMember = new ClubMember();
    clubMember.club = await Cache.getClub(clubCode);
    clubMember.player = await Cache.getPlayer(playerId);
    clubMember.joinedDate = new Date();
    clubMember.status = ClubMemberStatus.PENDING;
    if (player.bot) {
      // bots are allowed to buy as much as they wantt
      clubMember.status = ClubMemberStatus.ACTIVE;
      clubMember.autoBuyinApproval = true;

      if (player.uuid === 'c2dc2c3d-13da-46cc-8c66-caa0c77459de') {
        // Making one of the bots as the manager.
        // This is for the botrunner to start an app game with a club created by a human.
        clubMember.isManager = true;
      }
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    await clubMemberRepository.save(clubMember);
    return clubMember.status;
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

    if (clubMember.status === ClubMemberStatus.ACTIVE) {
      return clubMember.status;
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
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
    return ClubMemberStatus.ACTIVE;
  }

  public async rejectMember(
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

    if (clubMember.status === ClubMemberStatus.DENIED) {
      return clubMember.status;
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
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

    if (clubMember.status === ClubMemberStatus.KICKEDOUT) {
      return clubMember.status;
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
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
    const clubRepository = getRepository<Club>(Club);
    const playerRepository = getRepository<Player>(Player);

    const club = await clubRepository.findOne({where: {clubCode: clubCode}});
    const player = await playerRepository.findOne({where: {uuid: playerId}});
    if (!club) {
      throw new Error(`Club ${clubCode} is not found`);
    }

    if (!player) {
      throw new Error(`Player ${playerId} is not found`);
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
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
    const clubRepository = getRepository<Club>(Club);
    const club = await clubRepository.findOne({where: {clubCode: clubCode}});
    if (!club) {
      throw new Error(`Club ${clubCode} is not found`);
    }
    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
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

  public async isClubMember(
    clubCode: string,
    playerId: string
  ): Promise<ClubMember | null> {
    const playerRepository = getRepository<Player>(Player);
    const clubRepository = getRepository<Club>(Club);
    const club = await clubRepository.findOne({where: {clubCode: clubCode}});
    const player = await playerRepository.findOne({where: {uuid: playerId}});
    if (!club || !player) {
      return null;
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
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
    const playerRepository = getRepository<Player>(Player);
    const player = await playerRepository.findOne({where: {uuid: playerId}});
    if (!player) {
      throw new Error('Not found');
    }

    const query = fixQuery(`WITH my_clubs as (
      SELECT cm.club_id, count(*) member_count FROM club_member cm
      WHERE cm.club_id in (SELECT club_id FROM club_member WHERE player_id=?)
                 GROUP BY cm.club_id)
      SELECT c.club_code as "clubCode", member_count as "memberCount", c.name, p.name as "host", c.owner_id as "ownerId",
          cm.status as "memberStatus", c.status, cm.balance balance
      FROM club c JOIN my_clubs mc ON c.id = mc.club_id
      JOIN club_member cm ON cm.club_id = c.id AND cm.player_id=?
      JOIN player p ON p.id = c.owner_id`);
    const result = await getConnection().query(query, [player.id, player.id]);
    return result;
  }

  public async leaveClub(
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

    if (clubMember.status === ClubMemberStatus.LEFT) {
      return clubMember.status;
    }

    if (clubMember.isOwner) {
      throw new Error('Player is the owner. Owner cannot leave the club');
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    await clubMemberRepository
      .createQueryBuilder()
      .update()
      .set({
        status: ClubMemberStatus.LEFT,
      })
      .execute();
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
        pg.small_blind as "smallBlind", pg.big_blind as "bigBlind",
        pgt.no_hands_played as "handsPlayed", 
        pgt.no_hands_won as "handsWon", in_flop as "flopHands", in_turn as "turnHands",
        in_river as "riverHands", went_to_showdown as "showdownHands", 
        big_loss as "bigLoss", big_win as "bigWin", big_loss_hand as "bigLossHand", 
        big_win_hand as "bigWinHand", hand_stack,
        cm.player_id, pg.game_type as "gameType", 
        pg.started_at as "startedAt", p.name as "startedBy",
        pg.ended_at as "endedAt", pg.ended_by as "endedBy", 
        pg.started_at as "startedAt", pgt.session_time as "sessionTime", 
        (pgt.stack - pgt.buy_in) as balance 
        FROM
        poker_game pg JOIN club c ON pg.club_id  = c.id ${endedAt}
        JOIN player p ON pg.started_by = p.id
        JOIN club_member cm  ON cm.club_id  = c.id AND cm.player_id = ? AND c.club_code = ?
        LEFT OUTER JOIN player_game_tracker pgt ON 
        pgt.pgt_game_id = pg.id AND pgt.pgt_player_id = cm.player_id
        LEFT OUTER JOIN player_game_stats pgs ON 
        pgs.pgs_game_id = pg.id AND pgs.pgs_player_id = cm.player_id
        ORDER BY pg.id DESC`);

    // TODO: we need to do pagination here
    const result = await getConnection().query(query, [playerId, clubCode]);
    return result;
  }

  public async getClubGames1(
    clubCode: string,
    pageOptions?: PageOptions
  ): Promise<Array<PokerGame>> {
    if (!pageOptions) {
      pageOptions = {
        count: 20,
        prev: 0x7fffffff,
      };
    }

    let order: any = {
      id: 'ASC',
    };

    let pageWhere: any;
    if (pageOptions.next) {
      order = {
        id: 'DESC',
      };
      pageWhere = MoreThan(pageOptions.next);
    } else {
      if (pageOptions.prev) {
        order = {
          id: 'DESC',
        };
        pageWhere = LessThan(pageOptions.prev);
      }
    }
    //logger.info(`pageOptions count: ${pageOptions.count}`);
    let take = pageOptions.count;
    if (!take || take > 20) {
      take = 20;
    }
    const clubRepository = getRepository(Club);
    const club = await clubRepository.findOne({where: {clubCode: clubCode}});
    if (!club) {
      throw new Error(`Club ${clubCode} is not found`);
    }

    const findOptions: any = {
      where: {
        club: {id: club.id},
      },
      order: order,
      take: take,
    };

    if (pageWhere) {
      findOptions['where']['id'] = pageWhere;
    }

    const gameRespository = getRepository(PokerGame);
    const games = await gameRespository.find(findOptions);
    return games;
  }

  public async getClubById(clubCode: string): Promise<Club | undefined> {
    const repository = getRepository(Club);
    // get club by id (testing only)
    const club = await repository.findOne({where: {clubCode: clubCode}});
    if (!club) {
      throw new Error('Club not found');
    }
    return club;
  }

  public async getNextGameNum(clubId: number): Promise<number> {
    const nextGameNum = await getManager().transaction(
      async transactionEntityManager => {
        await transactionEntityManager
          .getRepository(Club)
          .createQueryBuilder()
          .update()
          .set({
            nextGameNum: () => 'next_game_num + 1',
          })
          .where({
            id: clubId,
          })
          .execute();

        const repo = transactionEntityManager.getRepository(Club);
        const club = await repo.findOne({id: clubId});
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
      const clubs = await getRepository(Club).find({
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
}

export const ClubRepository = new ClubRepositoryImpl();
