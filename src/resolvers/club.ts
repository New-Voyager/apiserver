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
import {centsToChips, chipsToCents} from '@src/utils';
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

  const club = await Cache.getClub(args.clubCode);
  if (args.filter?.unsettled) {
    if (!club.trackMemberCredit) {
      logger.warn(
        `Ignoring filter.unsettled for club not tracking member credit. Club: ${args.clubCode}`
      );
      delete args.filter.unsettled;
    }
  }

  if (args.filter?.inactiveFrom) {
    const date = new Date(Date.parse(args.filter.inactiveFrom));
    args.filter.inactiveFrom = date;
  }

  const clubMembers = await ClubRepository.getMembers(
    args.clubCode,
    args.filter
  );
  const clubMemberStat = await ClubRepository.getClubMemberStat(args.clubCode);
  const members = new Array<any>();
  for (const member of clubMembers) {
    if (member.status !== ClubMemberStatus.ACTIVE) {
      if (!(clubMember.isOwner || clubMember.isManager)) {
        continue;
      }
    }

    const memberAny = member as any;
    memberAny.memberId = member.id;
    memberAny.name = member.player.name;
    memberAny.playerId = member.player.uuid;
    memberAny.playerUuid = member.player.uuid;
    memberAny.externalId = member.player.uuid.split('-').pop();
    memberAny.lastPlayedDate = member.lastPlayedDate.toISOString();
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
    if (!club.trackMemberCredit) {
      memberAny.availableCredit = 0;
    }

    if (member.agent != null) {
      memberAny.agentName = member.agent.name;
      memberAny.agentUuid = member.agent.uuid;
    }

    if (member.status === ClubMemberStatus.PENDING) {
      memberAny.requestMessage = member.requestMessage;
    }
    members.push(memberAny);
  }
  return clubMembersToClientUnits(members);
}

function clubMembersToClientUnits(input: Array<any>): any {
  const resp = new Array<any>();
  for (const i of input) {
    const r = {...i};
    r.totalBuyins = centsToChips(r.totalBuyins);
    r.totalWinnings = centsToChips(r.totalWinnings);
    r.rakePaid = centsToChips(r.rakePaid);
    r.availableCredit = centsToChips(r.availableCredit);
    resp.push(r);
  }

  return resp;
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
    const retGame = {...(game as any)};
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

    retGame.dealerChoiceGames = [];
    if (game.dealerChoiceGames) {
      retGame.dealerChoiceGames = game.dealerChoiceGames.split(',');
    }
    retGame.roeGames = [];
    if (game.roeGames) {
      retGame.roeGames = game.roeGames.split(',');
    }
    ret.push(retGame);
  }
  // convert club games to PlayerClubGame
  return clubGamesToClientUnits(ret);
}

function clubGamesToClientUnits(input: Array<any>): any {
  const resp = new Array<any>();
  for (const i of input) {
    const r = {...i};
    r.smallBlind = centsToChips(r.smallBlind);
    r.bigBlind = centsToChips(r.bigBlind);
    r.balance = centsToChips(r.balance);
    resp.push(r);
  }

  return resp;
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
  // if (club.description === '') {
  //   errors.push('description is a required field');
  // }

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
    const clubMember = await Cache.getClubMember(playerId, clubCode);
    if (!clubMember) {
      throw new Error(`Club ${clubCode}, not a member`);
    }
    if (!clubMember.isOwner) {
      logger.error(
        `Unauthorized. ${playerId} is not the owner of the club ${clubCode}`
      );
      throw new Error('Unauthorized');
    }
    // const input = club as ClubUpdateInput;
    return await ClubRepository.updateClub(clubCode, clubUpdateInput);
  } catch (err) {
    logger.error(err);
    throw err;
  }
}

export async function joinClub(
  playerId: string,
  clubCode: string,
  requestMessage?: string
) {
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
  const status = await ClubRepository.joinClub(
    clubCode,
    playerId,
    requestMessage
  );
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
  // if (!playerId) {
  //   throw new Error('Unauthorized');
  // }
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

  const data = clubMemberUpdateInputToServerUnits(updateData);
  const status = await ClubRepository.updateClubMember(
    hostUuid,
    playerUuid,
    clubCode,
    data
  );
  return ClubMemberStatus[status];
}

function clubMemberUpdateInputToServerUnits(input: any): any {
  const r = {...input};
  // tipsBack should be in percent (not in chips)
  //r.tipsBack = chipsToCents(r.tipsBack);

  return r;
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
  return memberStatsToClientUnits(stats);
}

function memberStatsToClientUnits(input: Array<any>): any {
  const resp = new Array<any>();
  for (const i of input) {
    const r = {...i};
    r.buyin = centsToChips(r.buyin);
    r.profit = centsToChips(r.profit);
    r.rakePaid = centsToChips(r.rakePaid);
    resp.push(r);
  }

  return resp;
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

  let ch = await ClubRepository.getCreditHistory(
    playerId,
    clubCode,
    playerUuid
  );
  return creditHistoryToClientUnits(ch);
}

function creditHistoryToClientUnits(input: Array<any>): any {
  const resp = new Array<any>();
  for (const i of input) {
    const r = {...i};
    r.transId = r.id;
    r.amount = centsToChips(r.amount);
    r.updatedCredits = centsToChips(r.updatedCredits);
    r.tips = centsToChips(r.tips);
    resp.push(r);
  }

  return resp;
}

export async function clubMemberActivityGrouped(
  playerId: string,
  clubCode: string,
  startDate: Date,
  endDate: Date
) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubCode === '') {
    errors.push('Invalid club');
  }
  if (!startDate) {
    errors.push('Invalid startDate');
  }
  if (!endDate) {
    errors.push('Invalid endDate');
  }
  if (startDate > endDate) {
    errors.push('Invalid dates');
  }
  if (errors.length > 0) {
    logger.error(
      'Invalid argument for clubMemberActivityGrouped: ' + errors.join(' ')
    );
    throw new Error('Invalid argument');
  }

  const a = await ClubRepository.clubMemberActivityGrouped(
    playerId,
    clubCode,
    startDate,
    endDate
  );

  return activityToClientUnits(a);
}

export async function agentPlayersActivity(
  playerId: string,
  agentId: string,
  clubCode: string,
  startDate: Date,
  endDate: Date
) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubCode === '') {
    errors.push('Invalid club');
  }
  if (!startDate) {
    errors.push('Invalid startDate');
  }
  if (!endDate) {
    errors.push('Invalid endDate');
  }
  if (startDate > endDate) {
    errors.push('Invalid dates');
  }
  if (errors.length > 0) {
    logger.error(
      'Invalid argument for clubMemberActivityGrouped: ' + errors.join(' ')
    );
    throw new Error('Invalid argument');
  }

  const a = await ClubRepository.agentPlayersActivity(
    agentId,
    clubCode,
    startDate,
    endDate
  );

  return activityToClientUnits(a);
}

function activityToClientUnits(input: Array<any>): any {
  const resp = new Array<any>();
  for (const a of input) {
    const activity = {...a};
    activity.availableCredit = centsToChips(activity.availableCredit);
    activity.tips = centsToChips(activity.tips);
    activity.tipsBackAmount = centsToChips(activity.tipsBackAmount);
    activity.buyIn = centsToChips(activity.buyIn);
    activity.profit = centsToChips(activity.profit);
    resp.push(activity);
  }

  return resp;
}

export async function setCredit(
  playerId: string,
  clubCode: string,
  playerUuid: string,
  chips: number,
  notes: string,
  followup: boolean
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
  if (chips === null || chips === undefined) {
    errors.push('Invalid amount');
  }
  if (errors.length > 0) {
    logger.error('Invalid argument for setCredit: ' + errors.join(' '));
    throw new Error('Invalid argument');
  }

  const cents = chipsToCents(chips);
  const ret = await ClubRepository.adminSetCredit(
    playerId,
    clubCode,
    playerUuid,
    cents,
    notes,
    followup
  );
  return ret;
}

export async function addCredit(
  playerId: string,
  clubCode: string,
  playerUuid: string,
  chips: number,
  notes: string,
  followup: boolean
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
  if (chips === null || chips === undefined) {
    errors.push('Invalid amount');
  }
  if (errors.length > 0) {
    logger.error('Invalid argument for addCredit: ' + errors.join(' '));
    throw new Error('Invalid argument');
  }

  const cents = chipsToCents(chips);
  const ret = await ClubRepository.adminAddCredit(
    playerId,
    clubCode,
    playerUuid,
    cents,
    notes,
    followup
  );
  return ret;
}

export async function deductCredit(
  playerId: string,
  clubCode: string,
  playerUuid: string,
  chips: number,
  notes: string,
  followup: boolean
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
  if (chips === null || chips === undefined) {
    errors.push('Invalid amount');
  }
  if (errors.length > 0) {
    logger.error('Invalid argument for addCredit: ' + errors.join(' '));
    throw new Error('Invalid argument');
  }

  const cents = chipsToCents(chips);
  const ret = await ClubRepository.adminDeductCredit(
    playerId,
    clubCode,
    playerUuid,
    cents,
    notes,
    followup
  );
  return ret;
}

export async function feeCredit(
  playerId: string,
  clubCode: string,
  playerUuid: string,
  chips: number,
  notes: string,
  followup: boolean
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
  if (chips === null || chips === undefined) {
    errors.push('Invalid amount');
  }
  if (errors.length > 0) {
    logger.error('Invalid argument for feeCredit: ' + errors.join(' '));
    throw new Error('Invalid argument');
  }

  const cents = chipsToCents(chips);
  const ret = await ClubRepository.adminFeeCredit(
    playerId,
    clubCode,
    playerUuid,
    cents,
    notes,
    followup
  );
  return ret;
}

export async function clearFollowup(
  playerId: string,
  clubCode: string,
  playerUuid: string,
  transId: number
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
    logger.error('Invalid argument for addCredit: ' + errors.join(' '));
    throw new Error('Invalid argument');
  }

  return ClubRepository.clearFollowup(playerId, clubCode, playerUuid, transId);
}

export async function clearAllFollowups(
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
    logger.error('Invalid argument for addCredit: ' + errors.join(' '));
    throw new Error('Invalid argument');
  }

  return ClubRepository.clearAllFollowups(playerId, clubCode, playerUuid);
}

export async function updateManagerRole(
  playerId: string,
  clubCode: string,
  role: any
) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (clubCode === '') {
    errors.push('Invalid club');
  }
  if (errors.length > 0) {
    logger.error('Invalid argument for updateManagerRole: ' + errors.join(' '));
    throw new Error('Invalid argument');
  }

  await ClubRepository.updateManagerRole(clubCode, role);
  return true;
}

async function checkInvitation(code: string): Promise<any> {
  return ClubRepository.checkInvitation(code);
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
    clubMemberActivityGrouped: async (parent, args, ctx, info) => {
      return clubMemberActivityGrouped(
        ctx.req.playerId,
        args.clubCode,
        args.startDate,
        args.endDate
      );
    },
    agentPlayersActivity: async (parent, args, ctx, info) => {
      return agentPlayersActivity(
        ctx.req.playerId,
        args.agentId,
        args.clubCode,
        args.startDate,
        args.endDate
      );
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
      return joinClub(ctx.req.playerId, args.clubCode, args.requestMessage);
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
        args.notes,
        args.followup
      );
    },

    addCredit: async (parent, args, ctx, info) => {
      return addCredit(
        ctx.req.playerId,
        args.clubCode,
        args.playerUuid,
        args.amount,
        args.notes,
        args.followup
      );
    },

    deductCredit: async (parent, args, ctx, info) => {
      return deductCredit(
        ctx.req.playerId,
        args.clubCode,
        args.playerUuid,
        args.amount,
        args.notes,
        args.followup
      );
    },

    feeCredit: async (parent, args, ctx, info) => {
      return feeCredit(
        ctx.req.playerId,
        args.clubCode,
        args.playerUuid,
        args.amount,
        args.notes,
        args.followup
      );
    },

    clearFollowup: async (parent, args, ctx, info) => {
      return clearFollowup(
        ctx.req.playerId,
        args.clubCode,
        args.playerUuid,
        args.transId
      );
    },

    clearAllFollowups: async (parent, args, ctx, info) => {
      return clearAllFollowups(
        ctx.req.playerId,
        args.clubCode,
        args.playerUuid
      );
    },

    updateManagerRole: async (parent, args, ctx, info) => {
      return updateManagerRole(ctx.req.playerId, args.clubCode, args.role);
    },

    checkInvitation: async (parent, args, ctx, info) => {
      return checkInvitation(args.code);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
