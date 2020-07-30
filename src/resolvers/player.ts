import * as _ from 'lodash';
import {PlayerRepository} from '@src/repositories/player';
import {ClubRepository} from '@src/repositories/club';
import {ClubMemberStatus} from '@src/entity/club';
import {getLogger} from '@src/utils/log';
const logger = getLogger('player');

async function getClubs(playerId: string): Promise<Array<any>> {
  const clubMembers = await ClubRepository.getPlayerClubs(playerId);
  if (!clubMembers) {
    return [];
  }
  logger.debug(JSON.stringify(clubMembers[0]))
  const clubs = _.map(clubMembers, x => {
    return {
      name: x.name,
      private: true,
      imageId: '',
      clubCode: x.clubCode,
      memberCount: x.memberCount,
    };
  });
  return clubs;
}

const resolvers: any = {
  Query: {
    myClubs: async (parent, args, ctx, info) => {
      return getMyClubs(ctx.req.playerId);
    },
    /**
     * For testing(Without Authorization)
     */
    allPlayers: async (parent, args, ctx, info) => {
      return getAllPlayers();
    },
    playerById: async (parent, args, ctx, info) => {
      return getPlayerById(ctx.req.playerId);
    },
  },
  Mutation: {
    createPlayer: async (parent, args, ctx, info) => {
      return createPlayer(args);
    },
    leaveClub: async (parent, args, ctx, info) => {
      return leaveClub(ctx.req.playerId, args);
    },
  },
  Player: {
    clubs: async (parent, args, ctx, info) => {
      return getPlayerClubs(ctx.req.playerId, parent);
    },
  },
};

export function getResolvers() {
  return resolvers;
}

export async function getMyClubs(playerId: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  return getClubs(playerId);
}

/**
 * For testing(Without Authorization)
 */
export async function getAllPlayers() {
  const players = await PlayerRepository.getPlayers();
  return _.map(players, x => {
    return {
      playerId: x.uuid,
      name: x.name,
      lastActiveTime: x.updatedAt,
    };
  });
}

export async function getPlayerById(playerId: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const player = await PlayerRepository.getPlayerById(playerId);
  if (!player) {
    throw new Error('Player not found');
  }
  return {
    uuid: player.uuid,
    id: player.id,
    name: player.name,
    lastActiveTime: player.updatedAt,
  };
}

export async function createPlayer(args: any) {
  const errors = new Array<string>();
  if (!args.player) {
    errors.push('player object not found');
  }
  if (args.player.name === '') {
    errors.push('name is a required field');
  }
  if (args.player.deviceId === '') {
    errors.push('deviceId is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  try {
    const playerInput = args.player;
    return PlayerRepository.createPlayer(
      playerInput.name,
      playerInput.deviceId
    );
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to register Player');
  }
}

export async function leaveClub(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const isClubMember = await ClubRepository.isClubMember(
    args.clubCode,
    playerId
  );
  if (!isClubMember) {
    return ClubMemberStatus[ClubMemberStatus.LEFT];
  }
  await ClubRepository.leaveClub(args.clubCode, playerId);
  return ClubMemberStatus[ClubMemberStatus.LEFT];
}

export async function getPlayerClubs(playerId: string, parent: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  return getClubs(parent.playerId);
}
