import {
  ClubRepository,
  ClubCreateInput,
  ClubUpdateInput,
  ClubMemberUpdateInput,
} from '@src/repositories/club';
import {ClubMemberStatus, GameStatus} from '@src/entity/types';
import {Player} from '@src/entity/player';
import {PageOptions} from '@src/types';
import * as _ from 'lodash';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache';
const logger = getLogger('clubresolvers');

export async function getClubMembers(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const clubMembers1 = await ClubRepository.getMembers(args.clubCode);
  const clubMember = await ClubRepository.isClubMember(args.clubCode, playerId);
  if (!clubMember) {
    logger.error(
      `The user ${playerId} is not a member of ${
        args.clubCode
      }, ${JSON.stringify(clubMembers1)}`
    );
    throw new Error('Unauthorized');
  }

  if (clubMember.status == ClubMemberStatus.KICKEDOUT) {
    logger.error(`The user ${playerId} is kicked out of ${args.clubCode}`);
    throw new Error('Unauthorized');
  }

  const clubMembers = await ClubRepository.getMembers(args.clubCode);
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
      balance: member.balance,
      totalBuyins: member.totalBuyins,
      totalWinnings: member.totalWinnings,
      notes: member.notes,
    });
  }

  return members;
}

export async function getClubGames(
  playerId: string,
  clubCode: string,
  pageOptions?: PageOptions
): Promise<Array<any>> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const clubMember = await ClubRepository.isClubMember(clubCode, playerId);
  if (!clubMember) {
    logger.error(`The user ${playerId} is not a member of ${clubCode}`);
    throw new Error('Unauthorized');
  }
  const clubGames = await ClubRepository.getClubGames(clubCode, pageOptions);
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
      gameCode: x.gameCode,
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
  clubCode: string
): Promise<any> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  //const club = await ClubRepository.getClubById(clubCode);
  const club = await Cache.getClub(clubCode);
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

export async function updateClub(
  playerId: string,
  clubCode: string,
  club: any
) {
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
    const club = await ClubRepository.getClub(clubCode);
    if (!club) {
      throw new Error(`Club ${clubCode} is not found`);
    }
    const owner: Player | undefined = await Promise.resolve(club.owner);
    if (!owner) {
      throw new Error(`Club ${clubCode} does not have a owner`);
    }
    if (playerId != owner.uuid) {
      const a = JSON.stringify(club.owner);
      throw new Error(
        `Unauthorized. ${playerId} is not the owner of the club ${clubCode}, ${a}`
      );
    }
    const input = club as ClubUpdateInput;
    return ClubRepository.updateClub(clubCode, input);
  } catch (err) {
    logger.error(err);
    throw err;
  }
}

export async function joinClub(playerId: string, clubCode: string) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubCode === '') {
    errors.push('clubCode is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  // TODO: We need to get owner id from the JWT
  const status = await ClubRepository.joinClub(clubCode, playerId);
  return ClubMemberStatus[status];
}

export async function deleteClub(playerId: string, clubCode: string) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubCode === '') {
    errors.push('clubCode is a required field');
  }
  // ensure this player is the owner of the club
  if (!(await ClubRepository.isClubOwner(clubCode, playerId))) {
    throw new Error('Unauthorized. Only owner can delete the club');
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  await ClubRepository.deleteClub(clubCode);
  return true;
}

export async function approveMember(
  playerId: string,
  clubCode: string,
  playerUuid: string
) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubCode === '') {
    errors.push('clubCode is a required field');
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
    clubCode,
    playerUuid
  );
  return ClubMemberStatus[status];
}

export async function rejectMember(
  playerId: string,
  clubCode: string,
  playerUuid: string
) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubCode === '') {
    errors.push('clubCode is a required field');
  }
  if (playerUuid === '') {
    errors.push('playerUuid is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  // TODO: We need to get owner id from the JWT
  const ownerId = playerId;
  const status = await ClubRepository.rejectMember(
    ownerId,
    clubCode,
    playerUuid
  );
  return ClubMemberStatus[status];
}

export async function kickMember(
  playerId: string,
  clubCode: string,
  playerUuid: string
) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubCode === '') {
    errors.push('clubCode is a required field');
  }
  if (playerUuid === '') {
    errors.push('playerUuid is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  // TODO: We need to get owner id from the JWT
  const ownerId = playerId;
  const status = await ClubRepository.kickMember(ownerId, clubCode, playerUuid);
  return ClubMemberStatus[status];
}

export async function leaveClub(playerId: string, clubCode: string) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubCode === '') {
    errors.push('clubCode is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  // TODO: We need to get owner id from the JWT
  const ownerId = playerId;
  const status = await ClubRepository.leaveClub(clubCode, playerId);
  return ClubMemberStatus[status];
}

export async function getMemberStatus(playerId: string, clubCode: string) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubCode === '') {
    errors.push('clubCode is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  return await ClubRepository.getClubMemberStatus(clubCode, playerId);
}

export async function updateClubMember(
  hostUuid: string,
  playerUuid: string,
  clubCode: string,
  updateData: ClubMemberUpdateInput
) {
  const errors = new Array<string>();
  if (!hostUuid || hostUuid === '') {
    throw new Error('Unauthorized');
  }
  if (!clubCode || clubCode === '') {
    errors.push('clubCode is a required field');
  }
  if (!playerUuid || playerUuid === '') {
    errors.push('playerUuid is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  const status = await ClubRepository.updateClubMember(
    hostUuid,
    playerUuid,
    clubCode,
    updateData
  );
  return ClubMemberStatus[status];
}

const resolvers: any = {
  Query: {
    clubMembers: async (parent, args, ctx, info) => {
      return getClubMembers(ctx.req.playerId, args);
    },

    clubGames: async (parent, args, ctx, info) => {
      return getClubGames(ctx.req.playerId, args.clubCode, args.page);
    },

    clubById: async (parent, args, ctx, info) => {
      return getClubById(ctx.req.playerId, args.clubCode);
    },

    clubMemberStatus: async (parent, args, ctx, info) => {
      return getMemberStatus(ctx.req.playerId, args.clubCode);
    },
  },
  Mutation: {
    createClub: async (parent, args, ctx, info) => {
      return createClub(ctx.req.playerId, args.club);
    },
    deleteClub: async (parent, args, ctx, info) => {
      return deleteClub(ctx.req.playerId, args.clubCode);
    },
    updateClub: async (parent, args, ctx, info) => {
      return updateClub(ctx.req.playerId, args.clubCode, args.club);
    },
    joinClub: async (parent, args, ctx, info) => {
      return joinClub(ctx.req.playerId, args.clubCode);
    },

    approveMember: async (parent, args, ctx, info) => {
      return approveMember(ctx.req.playerId, args.clubCode, args.playerUuid);
    },

    rejectMember: async (parent, args, ctx, info) => {
      return rejectMember(ctx.req.playerId, args.clubCode, args.playerUuid);
    },

    kickMember: async (parent, args, ctx, info) => {
      return kickMember(ctx.req.playerId, args.clubCode, args.playerUuid);
    },

    leaveClub: async (parent, args, ctx, info) => {
      return leaveClub(ctx.req.playerId, args.clubCode);
    },

    updateClubMember: async (parent, args, ctx, info) => {
      return updateClubMember(
        ctx.req.playerId,
        args.playerUuid,
        args.clubCode,
        args.update
      );
    },
  },
};

export function getResolvers() {
  return resolvers;
}
