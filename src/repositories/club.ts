import {v4 as uuidv4} from 'uuid';
import {Club, ClubMember, ClubMemberStatus} from '@src/entity/club';
import {Player} from '@src/entity/player';
import {
  getConnection,
  getRepository,
  getManager,
  Not,
  LessThan,
  MoreThan,
} from 'typeorm';
import {PokerGame, GameType, PlayerGame} from '@src/entity/game';
import {PageOptions} from '@src/types';
import {getLogger} from '@src/utils/log';
const logger = getLogger('club');

export interface ClubCreateInput {
  ownerUuid: string;
  name: string;
  description: string;
}

export interface ClubUpdateInput {
  name: string;
  description: string;
}

function isPostgres() {
  if (process.env.DB_USED === 'sqllite') {
    return false;
  }
  return true;
}

class ClubRepositoryImpl {
  public async getClub(clubId: string): Promise<Club | undefined> {
    const clubRepository = getRepository(Club);
    const club = await clubRepository.findOne({where: {displayId: clubId}});
    return club;
  }
  public async updateClub(
    clubId: string,
    input: ClubUpdateInput,
    club?: Club
  ): Promise<boolean> {
    const clubRepository = getRepository(Club);

    if (!club) {
      club = await clubRepository.findOne({where: {displayId: clubId}});
      if (!club) {
        throw new Error(`Club ${clubId} is not found`);
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

  public async createClub(input: ClubCreateInput): Promise<string> {
    // whoever creates this club is the owner of the club
    let clubId = '';
    const clubRepository = getRepository(Club);

    while (true) {
      // find whether the club already exists
      const uuid: string = uuidv4();
      clubId = uuid.substr(uuid.lastIndexOf('-') + 1);
      clubId = clubId.toUpperCase();
      const club = await clubRepository.findOne({where: {displayId: clubId}});
      if (!club) {
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
    club.displayId = clubId;
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

    return club.displayId;
  }

  public async joinClub(
    clubId: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    let [club, player, clubMember] = await this.getClubMember(clubId, playerId);

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
    clubId: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    const [club, player, clubMember] = await this.getClubMember(
      clubId,
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

    if (clubMember.status == ClubMemberStatus.ACTIVE) {
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
    clubId: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    const [club, player, clubMember] = await this.getClubMember(
      clubId,
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

    if (clubMember.status == ClubMemberStatus.DENIED) {
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
    clubId: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    const [club, player, clubMember] = await this.getClubMember(
      clubId,
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

    if (clubMember.status == ClubMemberStatus.KICKEDOUT) {
      return clubMember.status;
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    // create a new membership
    clubMember.status = ClubMemberStatus.KICKEDOUT;
    await clubMemberRepository.save(clubMember);
    return clubMember.status;
  }

  protected async getClubMember(
    clubId: string,
    playerId: string
  ): Promise<[Club, Player, ClubMember | undefined]> {
    const clubRepository = getRepository<Club>(Club);
    const playerRepository = getRepository<Player>(Player);

    const club = await clubRepository.findOne({where: {displayId: clubId}});
    const player = await playerRepository.findOne({where: {uuid: playerId}});
    if (!club) {
      throw new Error(`Club ${clubId} is not found`);
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

  public async getMembers(clubId: string): Promise<ClubMember[]> {
    const clubRepository = getRepository<Club>(Club);
    const club = await clubRepository.findOne({where: {displayId: clubId}});
    if (!club) {
      throw new Error(`Club ${clubId} is not found`);
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
    clubId: string,
    playerId: string
  ): Promise<ClubMember | null> {
    const playerRepository = getRepository<Player>(Player);
    const clubRepository = getRepository<Club>(Club);
    const club = await clubRepository.findOne({where: {displayId: clubId}});
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
    const query = `SELECT c.name, c.display_id clubid, COUNT(*) memberCount FROM club_member cm JOIN club c
             ON cm.club_id = c.id WHERE cm.player_id = ${placeHolder} 
             GROUP BY c.name, c.display_id, cm.club_id`;
    const result = await getConnection().query(query, [player.id]);
    return result;
  }

  public async leaveClub(
    clubId: string,
    playerId: string
  ): Promise<ClubMemberStatus> {
    const [club, player, clubMember] = await this.getClubMember(
      clubId,
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
    clubId: string,
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
    const club = await clubRepository.findOne({where: {displayId: clubId}});
    if (!club) {
      throw new Error(`Club ${clubId} is not found`);
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

  public async getClubById(clubId: string): Promise<Club | undefined> {
    const repository = getRepository(Club);
    // get club by id (testing only)
    const club = await repository.findOne({where: {displayId: clubId}});
    return club;
  }
}

export const ClubRepository = new ClubRepositoryImpl();
