import * as _ from 'lodash';
import {PlayerRepository} from '@src/repositories/player';
import {ClubRepository} from '@src/repositories/club';
import {ClubMemberStatus} from '@src/entity/club';
import {getLogger} from '@src/utils/log';
import { GameRepository } from '@src/repositories/game';
import { GameStatus } from '@src/entity/game';
import { GameType } from '@src/entity/hand';
import { PlayerStatus } from '@src/entity/chipstrack';
const logger = getLogger('player');

async function getClubs(playerId: string): Promise<Array<any>> {
  const clubMembers = await ClubRepository.getPlayerClubs(playerId);
  if (!clubMembers) {
    return [];
  }
  const clubs = _.map(clubMembers, x => {
    let isOwner = false;
    if (x.ownerId === playerId) {
      isOwner = true;
    }
    return {
      name: x.name,
      private: true,
      imageId: '',
      isOwner: isOwner,
      clubCode: x.clubCode,
      memberCount: parseInt(x.memberCount),
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

    liveGames: async (parent, args, ctx, info) => {
      return getLiveGames(ctx.req.playerId);
    },

    pastGames: async (parent, args, ctx, info) => {
      return getPastGames(ctx.req.playerId);
    },

    myInfo: async (parent, args, ctx, info) => {
      return getPlayerInfo(ctx.req.playerId);
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
      email: x.email,
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
    email: player.email,
    lastActiveTime: player.updatedAt,
  };
}

export async function getPlayerInfo(playerId: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const player = await PlayerRepository.getPlayerInfo(playerId);
  if (!player) {
    throw new Error('Player not found');
  }
  return {
    uuid: player.uuid,
    id: player.id,
    name: player.name,
    email: player.email,
    lastActiveTime: player.updatedAt,
  };
}

export async function createPlayer(args: any) {
  const errors = validate();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const playerInput = args.player;
    return PlayerRepository.createPlayer(
      playerInput.name,
      playerInput.email,
      playerInput.password,
      playerInput.deviceId
    );
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to register Player');
  }

  function validate() {
    const errors = new Array<string>();
    if (!args.player) {
      errors.push('player object not found');
    }
    if (isEmpty(args.player.name)) {
      errors.push('name is a required field');
    }
    if (isEmpty(args.player.deviceId) && isEmpty(args.player.email)) {
      errors.push('deviceId or email should be specified');
    }
    if (!isEmpty(args.player.email) && isEmpty(args.player.password)) {
      errors.push('password should be specified');
    }

    return errors;

    function isEmpty(value: any) {
      return value === undefined || value === '';
    }
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

async function getLiveGames(playerId: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const liveGames = await GameRepository.getLiveGames(playerId);
  let game: any;
  for (game of liveGames) {
    game.elapsedTime = Math.floor(game.elapsedTime);
    game.status = GameStatus[game['gameStatus']];
    game.gameType = GameType[game['gameType']];
    game.playerStatus = PlayerStatus[game['playerStatus']];
  }
  return liveGames;
}

async function getPastGames(playerId: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const pastGames = await GameRepository.getPastGames(playerId);
  let game: any;
  for (game of pastGames) {
    game.gameTime = Math.floor(game.gameTime);
    game.sessionTime = Math.floor(game.sessionTime);
    game.status = GameStatus[game['gameStatus']];
    game.gameType = GameType[game['gameType']];
    game.playerStatus = PlayerStatus[game['playerStatus']];
  }
  return pastGames;
}
