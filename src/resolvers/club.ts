import {
  ClubRepository,
  ClubCreateInput,
  ClubUpdateInput,
} from '@src/repositories/club';
import {ClubMemberStatus, Club} from '@src/entity/club';
import {Player} from '@src/entity/player';
import {PageOptions} from '@src/types';
import * as _ from 'lodash';
import {GameStatus} from '@src/entity/game';
import {getLogger} from '@src/utils/log';
const logger = getLogger('clubresolvers');

export async function getClubMembers(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const clubMembers1 = await ClubRepository.getMembers(args.clubId);
  const clubMember = await ClubRepository.isClubMember(args.clubId, playerId);
  if (!clubMember) {
    logger.error(
      `The user ${playerId} is not a member of ${args.clubId}, ${JSON.stringify(
        clubMembers1
      )}`
    );
    throw new Error('Unauthorized');
  }

  if (clubMember.status == ClubMemberStatus.KICKEDOUT) {
    logger.error(`The user ${playerId} is kicked out of ${args.clubId}`);
    throw new Error('Unauthorized');
  }

  const clubMembers = await ClubRepository.getMembers(args.clubId);
  const members = new Array<any>();
  for (const member of clubMembers) {
    members.push({
      name: member.player.name,
      joinedDate: member.joinedDate,
      status: ClubMemberStatus[member.status],
      lastGamePlayedDate: null,
      imageId: '',
      isOwner: member.isOwner,
      isManager: member.isManager,
      playerId: member.player.uuid,
    });
  }

  return members;
}

export async function getClubGames(
  playerId: string,
  clubId: string,
  pageOptions?: PageOptions
): Promise<Array<any>> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const clubMember = await ClubRepository.isClubMember(clubId, playerId);
  if (!clubMember) {
    logger.error(`The user ${playerId} is not a member of ${clubId}`);
    throw new Error('Unauthorized');
  }
  const clubGames = await ClubRepository.getClubGames(clubId, pageOptions);
  const ret = _.map(clubGames, x => {
    let endedAt;
    let endedBy;
    if (x.endedAt) {
      endedAt = x.endedAt;
      if (x.endedBy) {
        endedBy = x.endedBy.name;
      }
    }

    return {
      pageId: x.id,
      title: x.title,
      type: x.gameType,
      gameId: x.gameId,
      startedBy: x.startedBy.name,
      startedAt: x.startedAt,
      status: GameStatus[x.status],
      endedAt: endedAt,
      endedBy: endedBy,
    };
  });
  // convert club games to PlayerClubGame
  return ret;
}

export async function getClubById(
  playerId: string,
  clubId: string
): Promise<any> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const club = await ClubRepository.getClubById(clubId);
  if (!club) {
    throw new Error('Club not found');
  }
  return {
    id: club.id,
  };
}

export async function createClub(playerId: string, club: ClubCreateInput) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (!club) {
    errors.push('club object not found');
  }
  if (club.name === '') {
    errors.push('name is a required field');
  }
  if (club.description === '') {
    errors.push('description is a required field');
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  try {
    const input = club as ClubCreateInput;
    input.ownerUuid = playerId;
    return ClubRepository.createClub(input);
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to create the club');
  }
}

export async function updateClub(playerId: string, clubId: string, club: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (!club) {
    errors.push('club object not found');
  }
  if (club.name && club.name === '') {
    errors.push('name is a required field');
  }
  if (club.description && club.description === '') {
    errors.push('description is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  try {
    const club = await ClubRepository.getClub(clubId);
    if (!club) {
      throw new Error(`Club ${clubId} is not found`);
    }
    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error(`Club ${clubId} does not have a owner`);
    }
    if (playerId != owner.uuid) {
      const a = JSON.stringify(club.owner);
      throw new Error(
        `Unauthorized. ${playerId} is not the owner of the club ${clubId}, ${a}`
      );
    }
    const input = club as ClubUpdateInput;
    return ClubRepository.updateClub(clubId, input);
  } catch (err) {
    logger.error(err);
    throw err;
  }
}

export async function joinClub(playerId: string, clubId: string) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubId === '') {
    errors.push('clubId is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  // TODO: We need to get owner id from the JWT
  const status = await ClubRepository.joinClub(clubId, playerId);
  return ClubMemberStatus[status];
}

export async function deleteClub(playerId: string, clubId: string) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubId === '') {
    errors.push('clubId is a required field');
  }
  // ensure this player is the owner of the club
  if (!(await ClubRepository.isClubOwner(clubId, playerId))) {
    throw new Error('Unauthorized. Only owner can delete the club');
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  await ClubRepository.deleteClub(clubId);
  return true;
}

export async function approveMember(
  playerId: string,
  clubId: string,
  playerUuid: string
) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubId === '') {
    errors.push('clubId is a required field');
  }
  if (playerUuid === '') {
    errors.push('playerUuid is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  // TODO: We need to get owner id from the JWT
  const ownerId = playerId;
  const status = await ClubRepository.approveMember(
    ownerId,
    clubId,
    playerUuid
  );
  return ClubMemberStatus[status];
}

export async function rejectMember(
  playerId: string,
  clubId: string,
  playerUuid: string
) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubId === '') {
    errors.push('clubId is a required field');
  }
  if (playerUuid === '') {
    errors.push('playerUuid is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  // TODO: We need to get owner id from the JWT
  const ownerId = playerId;
  const status = await ClubRepository.rejectMember(ownerId, clubId, playerUuid);
  return ClubMemberStatus[status];
}

export async function kickMember(
  playerId: string,
  clubId: string,
  playerUuid: string
) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubId === '') {
    errors.push('clubId is a required field');
  }
  if (playerUuid === '') {
    errors.push('playerUuid is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  // TODO: We need to get owner id from the JWT
  const ownerId = playerId;
  const status = await ClubRepository.kickMember(ownerId, clubId, playerUuid);
  return ClubMemberStatus[status];
}

export async function leaveClub(playerId: string, clubId: string) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubId === '') {
    errors.push('clubId is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  // TODO: We need to get owner id from the JWT
  const ownerId = playerId;
  const status = await ClubRepository.leaveClub(clubId, playerId);
  return ClubMemberStatus[status];
}

export async function getMemberStatus(playerId: string, clubId: string) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubId === '') {
    errors.push('clubId is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  return await ClubRepository.getClubMemberStatus(clubId, playerId);
}

const resolvers: any = {
  Query: {
    clubMembers: async (parent, args, ctx, info) => {
      return getClubMembers(ctx.req.playerId, args);
    },

    clubGames: async (parent, args, ctx, info) => {
      return getClubGames(ctx.req.playerId, args.clubId, args.page);
    },

    clubById: async (parent, args, ctx, info) => {
      return getClubById(ctx.req.playerId, args.clubId);
    },

    clubMemberStatus: async (parent, args, ctx, info) => {
      return getMemberStatus(ctx.req.playerId, args.clubId);
    },
  },
  Mutation: {
    createClub: async (parent, args, ctx, info) => {
      return createClub(ctx.req.playerId, args.club);
    },
    deleteClub: async (parent, args, ctx, info) => {
      return deleteClub(ctx.req.playerId, args.clubId);
    },
    updateClub: async (parent, args, ctx, info) => {
      return updateClub(ctx.req.playerId, args.clubId, args.club);
    },
    joinClub: async (parent, args, ctx, info) => {
      return joinClub(ctx.req.playerId, args.clubId);
    },

    approveMember: async (parent, args, ctx, info) => {
      return approveMember(ctx.req.playerId, args.clubId, args.playerUuid);
    },

    rejectMember: async (parent, args, ctx, info) => {
      return rejectMember(ctx.req.playerId, args.clubId, args.playerUuid);
    },

    kickMember: async (parent, args, ctx, info) => {
      return kickMember(ctx.req.playerId, args.clubId, args.playerUuid);
    },

    leaveClub: async (parent, args, ctx, info) => {
      return leaveClub(ctx.req.playerId, args.clubId);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
