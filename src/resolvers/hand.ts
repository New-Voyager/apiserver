import {HandRepository} from '@src/repositories/hand';
import {HandHistory, HandWinners} from '@src/entity/hand';
import {ClubRepository} from '@src/repositories/club';
import {Club} from '@src/entity/club';
import {WonAtStatus, GameType, ClubMemberStatus} from '@src/entity/types';
import {PlayerRepository} from '@src/repositories/player';
import {getLogger} from '@src/utils/log';
import {GameRepository} from '@src/repositories/game';
const logger = getLogger('hand-resolvers');

const resolvers: any = {
  Query: {
    lastHandHistory: async (parent, args, ctx, info) => {
      return await getLastHandHistory(ctx.req.playerId, args);
    },
    specificHandHistory: async (parent, args, ctx, info) => {
      return await getSpecificHandHistory(ctx.req.playerId, args);
    },
    allHandHistory: async (parent, args, ctx, info) => {
      return await getAllHandHistory(ctx.req.playerId, args);
    },
    myWinningHands: async (parent, args, ctx, info) => {
      return await getMyWinningHands(ctx.req.playerId, args);
    },
    allStarredHands: async (parent, args, ctx, info) => {
      return await getAllStarredHands(ctx.req.playerId, args);
    },
  },
  Mutation: {
    saveStarredHand: async (parent, args, ctx, info) => {
      return await saveStarredHand(ctx.req.playerId, args);
    },
  },
};

export function getResolvers() {
  return resolvers;
}

async function generateHandHistoryData(handHistory: HandHistory) {
  return {
    pageId: handHistory.id,
    clubId: handHistory.clubId,
    data: handHistory.data,
    gameNum: handHistory.gameNum,
    gameType: GameType[handHistory.gameType],
    handNum: handHistory.handNum,
    loWinningCards: handHistory.loWinningCards,
    loWinningRank: handHistory.loWinningRank,
    showDown: handHistory.showDown,
    timeEnded: handHistory.timeEnded,
    timeStarted: handHistory.timeStarted,
    totalPot: handHistory.totalPot,
    winningCards: handHistory.winningCards,
    winningRank: handHistory.winningRank,
    wonAt: WonAtStatus[handHistory.wonAt],
  };
}

async function generateHandWinnersData(hand: HandWinners) {
  return {
    pageId: hand.id,
    clubId: hand.clubId,
    gameNum: hand.gameNum,
    handNum: hand.handNum,
    playerId: hand.playerId,
    isHigh: hand.isHigh,
    winningCards: hand.winningCards,
    winningRank: hand.winningRank,
    pot: hand.received,
  };
}

export async function getLastHandHistory(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  let club;
  if (args.clubCode !== '000000') {
    const clubMembers1 = await ClubRepository.getMembers(args.clubCode);
    const clubMember = await ClubRepository.isClubMember(
      args.clubCode,
      playerId
    );

    const player = await PlayerRepository.getPlayerById(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} is not found`);
    }
    club = await ClubRepository.getClubById(args.clubCode);
    if (!club) {
      throw new Error(`Club ${args.clubCode} is not found`);
    }
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

    if (clubMember.status !== ClubMemberStatus.ACTIVE) {
      logger.error(`The user ${playerId} is not Active in ${args.clubCode}`);
      throw new Error('Unauthorized');
    }
  } else {
    club = new Club();
    club.id = 0;
  }

  const game = await GameRepository.getGameById(args.gameCode);
  if (!game) {
    throw new Error(`Game ${args.gameCode} is not found`);
  }

  const handHistory = await HandRepository.getLastHandHistory(club.id, game.id);
  if (!handHistory) {
    throw new Error('No hand found');
  }
  return await generateHandHistoryData(handHistory);
}

export async function getSpecificHandHistory(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  let club;
  if (args.clubCode !== '000000') {
    const player = await PlayerRepository.getPlayerById(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} is not found`);
    }
    club = await ClubRepository.getClubById(args.clubCode);
    if (!club) {
      throw new Error(`Club ${args.clubCode} is not found`);
    }

    const clubMembers1 = await ClubRepository.getMembers(args.clubCode);
    const clubMember = await ClubRepository.isClubMember(
      args.clubCode,
      playerId
    );

    if (!clubMember) {
      logger.error(
        `The user ${playerId} is not a member of ${
          args.clubCode
        }, ${JSON.stringify(clubMembers1)}`
      );
      throw new Error('Unauthorized');
    }

    if (clubMember.status !== ClubMemberStatus.ACTIVE) {
      logger.error(`The user ${playerId} is not Active in ${args.clubCode}`);
      throw new Error('Unauthorized');
    }
  } else {
    club = new Club();
    club.id = 0;
  }

  const game = await GameRepository.getGameById(args.gameCode);
  if (!game) {
    throw new Error(`Game ${args.gameCode} is not found`);
  }

  const handHistory = await HandRepository.getSpecificHandHistory(
    club.id,
    game.id,
    args.handNum
  );
  if (!handHistory) {
    throw new Error('No hand found');
  }
  return await generateHandHistoryData(handHistory);
}

export async function getAllHandHistory(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  let club;
  if (args.clubCode !== '000000') {
    const player = await PlayerRepository.getPlayerById(playerId);
    if (!player) {
      throw new Error(`Player ${playerId} is not found`);
    }
    club = await ClubRepository.getClubById(args.clubCode);
    if (!club) {
      throw new Error(`Club ${args.clubCode} is not found`);
    }
    const clubMembers1 = await ClubRepository.getMembers(args.clubCode);
    const clubMember = await ClubRepository.isClubMember(
      args.clubCode,
      playerId
    );

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

    if (clubMember.status !== ClubMemberStatus.ACTIVE) {
      logger.error(`The user ${playerId} is not Active in ${args.clubCode}`);
      throw new Error('Unauthorized');
    }
  } else {
    club = new Club();
    club.id = 0;
  }

  const game = await GameRepository.getGameById(args.gameCode);
  if (!game) {
    throw new Error(`Game ${args.gameCode} is not found`);
  }

  const handHistory = await HandRepository.getAllHandHistory(
    club.id,
    game.id,
    args.page
  );
  const hands = new Array<any>();
  for (const hand of handHistory) {
    hands.push(await generateHandHistoryData(hand));
  }
  return hands;
}

export async function getMyWinningHands(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const player = await PlayerRepository.getPlayerById(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }
  let club;
  if (args.clubCode !== '000000') {
    club = await ClubRepository.getClubById(args.clubCode);
    if (!club) {
      throw new Error(`Club ${args.clubCode} is not found`);
    }
    const clubMembers1 = await ClubRepository.getMembers(args.clubCode);
    const clubMember = await ClubRepository.isClubMember(
      args.clubCode,
      playerId
    );

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

    if (clubMember.status !== ClubMemberStatus.ACTIVE) {
      logger.error(`The user ${playerId} is not Active in ${args.clubCode}`);
      throw new Error('Unauthorized');
    }
  } else {
    club = new Club();
    club.id = 0;
  }

  const game = await GameRepository.getGameById(args.gameCode);
  if (!game) {
    throw new Error(`Game ${args.gameCode} is not found`);
  }

  const handwinners = await HandRepository.getMyWinningHands(
    club.id,
    game.id,
    player.id,
    args.page
  );
  const hands = new Array<any>();

  for (const hand of handwinners) {
    hands.push(await generateHandWinnersData(hand));
  }
  return hands;
}

export async function getAllStarredHands(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const player = await PlayerRepository.getPlayerById(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }
  const handHistory = await HandRepository.getStarredHands(player.id);
  return handHistory;
}

export async function saveStarredHand(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  try {
    if (!args.clubCode) {
      errors.push('ClubCode is missing');
    }
    if (!args.gameCode) {
      errors.push('gameCode is missing');
    }
    if (!args.handNum) {
      errors.push('HandNum is missing');
    }
  } catch (err) {
    throw new Error('Internal server error');
  }

  if (errors.length) {
    throw new Error(JSON.stringify(errors));
  }
  const player = await PlayerRepository.getPlayerById(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }
  const game = await GameRepository.getGameById(args.gameCode);
  if (!game) {
    throw new Error(`Game ${args.gameCode} is not found`);
  }
  let club;
  if (args.clubCode !== '000000') {
    const clubMembers1 = await ClubRepository.getMembers(args.clubCode);
    const clubMember = await ClubRepository.isClubMember(
      args.clubCode,
      playerId
    );

    club = await ClubRepository.getClubById(args.clubCode);
    if (!club) {
      throw new Error(`Club ${args.clubCode} is not found`);
    }
    if (!clubMember) {
      logger.error(
        `The user ${playerId} is not a member of ${
          args.clubCode
        }, ${JSON.stringify(clubMembers1)}`
      );
      throw new Error('Unauthorized');
    }

    if (clubMember.status === ClubMemberStatus.KICKEDOUT) {
      logger.error(`The user ${playerId} is kicked out of ${args.clubCode}`);
      throw new Error('Unauthorized');
    }

    if (clubMember.status !== ClubMemberStatus.ACTIVE) {
      logger.error(`The user ${playerId} is not Active in ${args.clubCode}`);
      throw new Error('Unauthorized');
    }
  } else {
    club = new Club();
    club.id = 0;
  }

  const handHistory = await HandRepository.getSpecificHandHistory(
    club.id,
    game.id,
    args.handNum
  );
  if (!handHistory) {
    logger.error(`The hand ${args.handNum} is not found`);
    throw new Error('Hand not found');
  }

  const resp = await HandRepository.saveStarredHand(
    club.id,
    game.id,
    args.handNum,
    player.id,
    handHistory
  );
  return resp;
}
