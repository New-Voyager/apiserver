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
} from 'typeorm';
import {PokerGame} from '@src/entity/game';
import {PageOptions} from '@src/types';
import {getLogger} from '@src/utils/log';
import {getClubCode} from '@src/utils/uniqueid';
import {isPostgres} from '@src/utils';

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
  isManager: boolean;
  notes: string;
  balance: number;
  status: ClubMemberStatus;
  creditLimit: number;
  autoBuyinApproval: boolean;
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
    if (updateData.isManager !== null) {
      clubMember.isManager = updateData.isManager;
    }
    if (updateData.autoBuyinApproval !== null) {
      clubMember.autoBuyinApproval = updateData.autoBuyinApproval;
    }

    // Save the data
    const resp = await clubMemberRepository.save(clubMember);
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

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    await getManager().transaction(async transactionalEntityManager => {
      await clubRepository.save(club);
      await clubMemberRepository.save(clubMember);
    });

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
      await getManager().transaction(async transactionalEntityManager => {
        await getConnection()
          .createQueryBuilder()
          .delete()
          .from(ClubMember)
          .where('club_id = :id', {id: club.id})
          .execute();
        clubRepository.delete(club);
      });
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

    if (owner.uuid == playerId) {
      return true;
    }
    return false;
  }

  public async joinClub(
    clubCode: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    let [club, player, clubMember] = await this.getClubMember(
      clubCode,
      playerId
    );

    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    if (clubMember) {
      throw new Error(
        `The player is already in the club. Member status: ${
          ClubMemberStatus[clubMember.status]
        }`
      );
    }

    // create a new membership
    clubMember = new ClubMember();
    clubMember.club = club;
    clubMember.player = player;
    clubMember.joinedDate = new Date();
    clubMember.status = ClubMemberStatus.PENDING;

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    await clubMemberRepository.save(clubMember);
    return clubMember.status;
  }

  public async approveMember(
    ownerId: string,
    clubCode: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    const [club, player, clubMember] = await this.getClubMember(
      clubCode,
      playerId
    );

    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    if (owner.uuid != ownerId) {
      // TODO: make sure the ownerId is matching with club owner
      if (ownerId !== '') {
        throw new Error('Unauthorized');
      }
    }

    if (!clubMember) {
      throw new Error(`The player ${player.name} is not in the club`);
    }

    if (clubMember.status === ClubMemberStatus.ACTIVE) {
      return clubMember.status;
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    // create a new membership
    clubMember.status = ClubMemberStatus.ACTIVE;
    await clubMemberRepository.save(clubMember);
    return clubMember.status;
  }

  public async rejectMember(
    ownerId: string,
    clubCode: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    const [club, player, clubMember] = await this.getClubMember(
      clubCode,
      playerId
    );

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

    if (!clubMember) {
      throw new Error(`The player ${player.name} is not in the club`);
    }

    if (clubMember.status === ClubMemberStatus.DENIED) {
      return clubMember.status;
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    // create a new membership
    clubMember.status = ClubMemberStatus.DENIED;
    await clubMemberRepository.save(clubMember);
    return clubMember.status;
  }

  public async kickMember(
    ownerId: string,
    clubCode: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    const [club, player, clubMember] = await this.getClubMember(
      clubCode,
      playerId
    );
    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    if (owner.uuid != ownerId) {
      // TODO: make sure the ownerId is matching with club owner
      if (ownerId !== '') {
        throw new Error('Unauthorized');
      }
    }

    if (!clubMember) {
      throw new Error(`The player ${player.name} is not in the club`);
    }

    if (clubMember.status === ClubMemberStatus.KICKEDOUT) {
      return clubMember.status;
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    // create a new membership
    clubMember.status = ClubMemberStatus.KICKEDOUT;
    await clubMemberRepository.save(clubMember);
    return clubMember.status;
  }

  public async getClubMemberStatus(
    clubCode: string,
    playerId: string
  ): Promise<ClubMember> {
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
    const clubMember = await clubMemberRepository.findOne({
      where: {
        club: {id: club.id},
        player: {id: player.id},
      },
    });
    if (!clubMember) {
      throw new Error('No data found');
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

  public async getMembers(clubCode: string): Promise<ClubMember[]> {
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
    // see whehter the player is already a member
    const clubMembers = await clubMemberRepository.find({
      where: {
        club: {id: club.id},
        status: Not(ClubMemberStatus.LEFT),
      },
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

  public async getPlayerClubs(playerId: string): Promise<any[] | null> {
    const playerRepository = getRepository<Player>(Player);
    const player = await playerRepository.findOne({where: {uuid: playerId}});
    if (!player) {
      throw new Error('Not found');
    }
    let placeHolder = '$1';
    if (!isPostgres()) {
      placeHolder = '?';
    }
    const query = `WITH my_clubs as (
      SELECT cm.club_id, count(*) member_count FROM club_member cm
      WHERE cm.club_id in (SELECT club_id FROM club_member WHERE player_id=${placeHolder})
                 GROUP BY cm.club_id)
      SELECT c.club_code as "clubCode", member_count as "memberCount", c.name, c.owner_id as "ownerId" 
      FROM club c JOIN my_clubs mc ON c.id = mc.club_id`;
    const result = await getConnection().query(query, [player.id]);
    return result;
  }

  public async leaveClub(
    clubCode: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    const [club, player, clubMember] = await this.getClubMember(
      clubCode,
      playerId
    );

    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error('Unexpected. There is no owner for the club');
    }

    if (owner.uuid === player.uuid) {
      // owner cannot leave the club
      throw new Error('Owner cannot leave the club');
    }

    // the player is not a club member, probably already left
    if (!clubMember) {
      return ClubMemberStatus.LEFT;
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    clubMember.status = ClubMemberStatus.LEFT;
    await clubMemberRepository.save(clubMember);
    return clubMember.status;
  }

  public async getClubGames(
    clubCode: string,
    pageOptions?: PageOptions
  ): Promise<Array<any>> {
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
    logger.info(`pageOptions count: ${pageOptions.count}`);
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
}

export const ClubRepository = new ClubRepositoryImpl();
