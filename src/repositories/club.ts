import {getRepository} from "typeorm";
import { v4 as uuidv4 } from 'uuid';
import {Club, ClubMember, ClubMemberStatus} from '@src/entity/club';
import {Player} from '@src/entity/player';
import {getManager} from "typeorm";

export interface ClubCreateInput {
  ownerUuid: string;
  name: string;
  description: string;
};

class ClubRepositoryImpl {
  public async createClub(input: ClubCreateInput): Promise<string> {
    // whoever creates this club is the owner of the club
    let clubId: string = "";
    const clubRepository = getRepository(Club);

    while (true) {
      // find whether the club already exists
      const uuid: string = uuidv4();
      clubId = uuid.substr(uuid.lastIndexOf('-') + 1);
      clubId = clubId.toUpperCase();
      let club = await clubRepository.findOne({where: {displayId: clubId}});
      if(!club) {
        break;
      }
    }

    // locate the owner
    const playerRepository = getRepository<Player>(Player);
    const owner = await playerRepository.findOne({where: {uuid: input.ownerUuid}});
    if(!owner) {
      throw new Error(`Owner ${input.ownerUuid} is not found`);
    }
    let club = new Club();
    club.name = input.name;
    club.description = input.description;
    club.displayId = clubId;
    club.owner = playerRepository.findOne({where: {uuid: input.ownerUuid}});

    // create a new membership for the owner
    let clubMember = new ClubMember();
    clubMember.club = club;
    clubMember.player = owner;
    clubMember.isOwner = true;
    clubMember.joinedDate = new Date();
    clubMember.status = ClubMemberStatus.APPROVED;
    
    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    await getManager().transaction(async transactionalEntityManager => {
      await clubRepository.save(club);
      await clubMemberRepository.save(clubMember);
    });

    return club.displayId;
  }

  public async joinClub(ownerId: string, clubId: string, playerId: string): Promise<ClubMemberStatus> {
    let [club, player, clubMember] = await this.getClubMember(clubId, playerId);

    const owner: Player|undefined = await Promise.resolve(club.owner);
    if(!owner) {
      throw new Error(`Unexpected. There is no owner for the club`);
    }

    if (owner.uuid != ownerId) {
      // TODO: make sure the ownerId is matching with club owner
      if(ownerId !== "") {
        throw new Error("Unauthorized");
      }
    }
    if(clubMember) {
      throw new Error(`The player is already in the club. Member status: ${ClubMemberStatus[clubMember.status]}`);
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

  public async approveMember(ownerId: string, clubId: string, playerId: string): Promise<ClubMemberStatus> {
    let [club, player, clubMember] = await this.getClubMember(clubId, playerId);

    const owner: Player|undefined = await Promise.resolve(club.owner);
    if(!owner) {
      throw new Error(`Unexpected. There is no owner for the club`);
    }

    if (owner.uuid != ownerId) {
      // TODO: make sure the ownerId is matching with club owner
      if(ownerId !== "") {
        throw new Error("Unauthorized");
      }
    }

    if(!clubMember) {
      throw new Error(`The player ${player.name} is not in the club`);
    }

    if(clubMember.status == ClubMemberStatus.APPROVED) {
      return clubMember.status;
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    // create a new membership
    clubMember.status = ClubMemberStatus.APPROVED;
    await clubMemberRepository.save(clubMember);
    return clubMember.status;
  }

  public async rejectMember(ownerId: string, clubId: string, playerId: string): Promise<ClubMemberStatus> {
    let [club, player, clubMember] = await this.getClubMember(clubId, playerId);

    const owner: Player|undefined = await Promise.resolve(club.owner);
    if(!owner) {
      throw new Error(`Unexpected. There is no owner for the club`);
    }

    if (owner.uuid != ownerId) {
      // TODO: make sure the ownerId is matching with club owner
      if(ownerId !== "") {
        throw new Error("Unauthorized");
      }
    }

    if(!clubMember) {
      throw new Error(`The player ${player.name} is not in the club`);
    }

    if(clubMember.status == ClubMemberStatus.DENIED) {
      return clubMember.status;
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    // create a new membership
    clubMember.status = ClubMemberStatus.DENIED;
    await clubMemberRepository.save(clubMember);
    return clubMember.status;
  }  


  public async kickMember(ownerId: string, clubId: string, playerId: string): Promise<ClubMemberStatus> {
    let [club, player, clubMember] = await this.getClubMember(clubId, playerId);
    const owner: Player|undefined = await Promise.resolve(club.owner);
    if(!owner) {
      throw new Error(`Unexpected. There is no owner for the club`);
    }

    if (owner.uuid != ownerId) {
      // TODO: make sure the ownerId is matching with club owner
      if(ownerId !== "") {
        throw new Error("Unauthorized");
      }
    }

    if(!clubMember) {
      throw new Error(`The player ${player.name} is not in the club`);
    }

    if(clubMember.status == ClubMemberStatus.KICKEDOUT) {
      return clubMember.status;
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    // create a new membership
    clubMember.status = ClubMemberStatus.KICKEDOUT;
    await clubMemberRepository.save(clubMember);
    return clubMember.status;
  }  

  protected async getClubMember(clubId: string, playerId: string): Promise<[Club, Player, ClubMember|undefined]> {
    const clubRepository = getRepository<Club>(Club);
    const playerRepository = getRepository<Player>(Player);

    const club = await clubRepository.findOne({where:{displayId: clubId}});
    const player = await playerRepository.findOne({where: {uuid: playerId}});
    if(!club) {
      throw new Error(`Club ${clubId} is not found`);
    }

    if(!player) {
      throw new Error(`Player ${playerId} is not found`);
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    // see whehter the player is already a member
    let clubMember = await clubMemberRepository.findOne(
              {
                where: {
                    club: {id: club.id}, 
                    player: {id: player.id}
                  }
              });
    return [club, player, clubMember];
  }

  public async getMembers(clubId: string, ownerId: string): Promise<ClubMember[]> {
    const clubRepository = getRepository<Club>(Club);
    const club = await clubRepository.findOne({where:{displayId: clubId}});
    if(!club) {
     throw new Error(`Club ${clubId} is not found`);
    }

    const owner: Player|undefined = await Promise.resolve(club.owner);
    if(!owner) {
      throw new Error(`Unexpected. There is no owner for the club`);
    }

    if (owner.uuid != ownerId) {
      // TODO: make sure the ownerId is matching with club owner
      if(ownerId !== "") {
        throw new Error("Unauthorized");
      }
    }

    const clubMemberRepository = getRepository<ClubMember>(ClubMember);
    // see whehter the player is already a member
    let clubMembers = await clubMemberRepository.find(
              {
                where: {
                    club: {id: club.id}, 
                  }
              });
    return clubMembers;
  }
}

export const ClubRepository = new ClubRepositoryImpl();
