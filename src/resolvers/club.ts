import {
  ClubRepository,
  ClubCreateInput,
  ClubUpdateInput,
  ClubMemberUpdateInput,
} from '@src/repositories/club';
import {ClubMemberStatus, GameStatus, GameType} from '@src/entity/types';
import {Player} from '@src/entity/player/player';
import {PageOptions} from '@src/types';
import * as _ from 'lodash';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache';
import {AppCoinRepository} from '@src/repositories/appcoin';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const humanizeDuration = require('humanize-duration');

const logger = getLogger('resolvers::club');

export async function getClubMembers(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const clubMember = await ClubRepository.isClubMember(args.clubCode, playerId);
  if (!clubMember) {
    logger.error(
      `The user ${playerId} is not a member of club ${args.clubCode}`
    );
    throw new Error('Unauthorized');
  }

  if (clubMember.status !== ClubMemberStatus.ACTIVE) {
    logger.error(
      `The user ${playerId} is not an active member of club ${args.clubCode}`
    );
    throw new Error('Unauthorized');
  }

  const clubMembers = await ClubRepository.getMembers(
    args.clubCode,
    args.filter
  );
  const clubMemberStat = await ClubRepository.getClubMemberStat(args.clubCode);
  const members = new Array<any>();
  for (const member of clubMembers) {
    const memberAny = member as any;
    memberAny.memberId = member.id;
    memberAny.name = member.player.name;
    memberAny.playerId = member.player.uuid;
    memberAny.lastPlayedDate = member.lastPlayedDate;
    memberAny.contactInfo = member.contactInfo;
    memberAny.status = ClubMemberStatus[member.status];
    const stat = clubMemberStat[member.player.id];
    if (stat) {
      memberAny.totalGames = stat.totalGames;
      memberAny.totalBuyins = stat.totalBuyins;
      memberAny.totalWinnings = stat.totalWinnings;
      memberAny.totalHands = stat.totalHands;
      memberAny.rakePaid = stat.rakePaid;
    }
    members.push(memberAny);
  }
  return members;
}

export async function getClubGames(
  playerId: string,
  clubCode: string,
  completedGames?: boolean,
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
  const clubGames = await ClubRepository.getClubGames(
    clubCode,
    clubMember.player.id,
    completedGames
  );
  const ret = new Array<any>();
  const now = new Date().getTime();

  for (const game of clubGames) {
    const retGame = game as any;
    if (game.endedAt) {
      let runTime = game.endedAt - game.startedAt;
      const roundedRunTime = Math.ceil(runTime / (60 * 1000));
      runTime = roundedRunTime * (60 * 1000);
      game.runTime = roundedRunTime;
      game.runTimeStr = humanizeDuration(runTime, {round: true});
    }

    if (game.sessionTime) {
      let sessionTime = game.sessionTime;
      if (game.satAt) {
        sessionTime =
          sessionTime + Math.round((now - game.satAt.getTime()) / 1000);
      }
      const roundedTime = Math.ceil(sessionTime / 60);
      sessionTime = roundedTime;
      game.sessionTime = sessionTime;
      game.sessionTimeStr = humanizeDuration(sessionTime * 1000, {
        round: true,
      });
    }
    if (!game.endedBy) {
      game.endedBy = '';
    }
    retGame.gameType = GameType[game.gameType];
    ret.push(retGame);
  }
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
  clubUpdateInput: any
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }

  const errors = new Array<string>();
  if (clubUpdateInput.name && clubUpdateInput.name === '') {
    errors.push('name is a required field');
  }
  if (clubUpdateInput.description && clubUpdateInput.description === '') {
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
    if (playerId !== owner.uuid) {
      const a = JSON.stringify(club.owner);
      throw new Error(
        `Unauthorized. ${playerId} is not the owner of the club ${clubCode}, ${a}`
      );
    }
    // const input = club as ClubUpdateInput;
    return await ClubRepository.updateClub(clubCode, clubUpdateInput);
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

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  // ensure this player is the owner of the club
  if (!(await ClubRepository.isClubOwner(clubCode, playerId))) {
    throw new Error('Unauthorized. Only owner can delete the club');
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

// export async function leaveClub(playerId: string, clubCode: string) {
//   const errors = new Array<string>();
//   if (!playerId) {
//     throw new Error('Unauthorized');
//   }
//   console.log('qweqwe', clubCode);
//   if (clubCode === '') {
//     console.log('in error');
//     errors.push('clubCode is a required field');
//   }
//   if (errors.length > 0) {
//     throw new Error(errors.join('\n'));
//   }

//   // TODO: We need to get owner id from the JWT
//   const ownerId = playerId;
//   const status = await ClubRepository.leaveClub(clubCode, playerId);
//   return ClubMemberStatus[status];
// }

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

async function sendClubFcmMessage(clubCode: string, message: any) {
  const club = await ClubRepository.getClub(clubCode);
  if (!club) {
    throw new Error(`Club ${clubCode} is not found`);
  }
  await ClubRepository.broadcastMessage(club, message);
}

export async function clubLeaderBoard(playerId: string, clubCode: string) {
  const player = await Cache.getPlayer(playerId);
  if (!player) {
    throw new Error('Player not found');
  }
  const club = await Cache.getClub(clubCode);
  if (!club) {
    throw new Error('Club not found');
  }
  const stats = await ClubRepository.clubLeaderBoard(club.id);
  return stats;
}

export async function clubCoins(playerId: string, clubCode: string) {
  const player = await Cache.getPlayer(playerId);
  if (!player) {
    throw new Error('Player not found');
  }
  const club = await Cache.getClub(clubCode);
  if (!club) {
    throw new Error('Club not found');
  }
  // is this player a host or manager?
  const clubMember = await Cache.getClubMember(playerId, clubCode, true);
  if (!clubMember) {
    return 0;
  }
  if (!(clubMember.isManager || clubMember.isOwner)) {
    return 0;
  }

  // the owner's coins are club coins
  const owner = await Promise.resolve(club.owner);
  if (!owner) {
    return 0;
  }
  const coins = AppCoinRepository.availableCoins(owner.uuid);
  return coins;
}

export async function creditHistory(
  playerId: string,
  clubCode: string,
  playerUuid: string
) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubCode === '') {
    errors.push('Invalid club');
  }
  if (playerUuid === '') {
    errors.push('Invalid player');
  }
  if (errors.length > 0) {
    logger.error('Invalid argument for creditHistory: ' + errors.join(' '));
    throw new Error('Invalid argument');
  }

  return ClubRepository.getCreditHistory(playerId, clubCode, playerUuid);
}

export async function setCredit(
  playerId: string,
  clubCode: string,
  playerUuid: string,
  amount: number,
  notes: string
) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubCode === '') {
    errors.push('Invalid club');
  }
  if (playerUuid === '') {
    errors.push('Invalid player');
  }
  if (amount === null || amount === undefined) {
    errors.push('Invalid amount');
  }
  if (errors.length > 0) {
    logger.error('Invalid argument for setCredit: ' + errors.join(' '));
    throw new Error('Invalid argument');
  }

  return ClubRepository.adminSetCredit(
    playerId,
    clubCode,
    playerUuid,
    amount,
    notes
  );
}

const resolvers: any = {
  Query: {
    clubMembers: async (parent, args, ctx, info) => {
      return getClubMembers(ctx.req.playerId, args);
    },

    clubGames: async (parent, args, ctx, info) => {
      return getClubGames(
        ctx.req.playerId,
        args.clubCode,
        args.completedGames,
        args.page
      );
    },

    clubById: async (parent, args, ctx, info) => {
      return getClubById(ctx.req.playerId, args.clubCode);
    },

    clubLeaderBoard: async (parent, args, ctx, info) => {
      return clubLeaderBoard(ctx.req.playerId, args.clubCode);
    },

    clubCoins: async (parent, args, ctx, info) => {
      return clubCoins(ctx.req.playerId, args.clubCode);
    },

    creditHistory: async (parent, args, ctx, info) => {
      return creditHistory(ctx.req.playerId, args.clubCode, args.playerUuid);
    },
  },
  Mutation: {
    createClub: async (parent, args, ctx, info) => {
      logger.info(`Create club is called. Args: ${JSON.stringify(args)}`);
      const ret = await createClub(ctx.req.playerId, args.club);
      logger.info(`Create club returns ${JSON.stringify(ret)}`);
      return ret;
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

    // leaveClub: async (parent, args, ctx, info) => {
    //   return leaveClub(ctx.req.playerId, args.clubCode);
    // },

    updateClubMember: async (parent, args, ctx, info) => {
      return updateClubMember(
        ctx.req.playerId,
        args.playerUuid,
        args.clubCode,
        args.update
      );
    },

    sendClubFcmMessage: async (parent, args, ctx, info) => {
      return sendClubFcmMessage(args.clubCode, args.message);
    },

    setCredit: async (parent, args, ctx, info) => {
      return setCredit(
        ctx.req.playerId,
        args.clubCode,
        args.playerUuid,
        args.amount,
        args.notes
      );
    },
  },
};

export function getResolvers() {
  return resolvers;
}
