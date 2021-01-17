import {HandRepository} from '@src/repositories/hand';
import {HandHistory, HandWinners} from '@src/entity/hand';
import {ClubRepository} from '@src/repositories/club';
import {Club} from '@src/entity/club';
import {WonAtStatus, GameType, ClubMemberStatus} from '@src/entity/types';
import {PlayerRepository} from '@src/repositories/player';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache';
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

async function generateHandHistoryData(
  handHistory: HandHistory,
  includeData?: boolean
) {
  const handTime = Math.round(
    (handHistory.timeEnded.getTime() - handHistory.timeStarted.getTime()) / 1000
  );

  const ret: any = {
    pageId: handHistory.id,
    gameId: handHistory.gameId,
    gameType: GameType[handHistory.gameType],
    handNum: handHistory.handNum,
    loWinningCards: handHistory.loWinningCards,
    loWinningRank: handHistory.loWinningRank,
    showDown: handHistory.showDown,
    timeEnded: handHistory.timeEnded,
    timeStarted: handHistory.timeStarted,
    totalPot: handHistory.totalPot,
    handTime: handTime,
    winningCards: handHistory.winningCards,
    winningRank: handHistory.winningRank,
    wonAt: WonAtStatus[handHistory.wonAt],
    summary: handHistory.summary,
  };
  if (includeData) {
    ret.data = JSON.parse(handHistory.data);
  }
  return ret;
}

async function generateHandWinnersData(hand: HandWinners) {
  return {
    pageId: hand.id,
    gameId: hand.gameId,
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

  const game = await Cache.getGame(args.gameCode);
  if (!game) {
    throw new Error(`Game ${args.gameCode} is not found`);
  }

  if (game.club) {
    const clubMember = await Cache.getClubMember(playerId, game.club.clubCode);
    if (!clubMember) {
      logger.error(
        `Player: ${playerId} is not authorized to start the game ${args.gameCode} in club ${game.club.name}`
      );
      throw new Error(
        `Player: ${playerId} is not authorized to start the game ${args.gameCode}`
      );
    }

    if (clubMember.status !== ClubMemberStatus.ACTIVE) {
      logger.error(`The user ${playerId} is not Active in ${args.clubCode}`);
      throw new Error('Unauthorized');
    }
  }

  const handHistory = await HandRepository.getLastHandHistory(game.id);
  if (!handHistory) {
    throw new Error('No hand found');
  }
  return await generateHandHistoryData(handHistory);
}

export async function getSpecificHandHistory(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }

  const game = await Cache.getGame(args.gameCode);
  if (!game) {
    throw new Error(`Game ${args.gameCode} is not found`);
  }

  if (game.club) {
    const clubMember = await Cache.getClubMember(playerId, game.club.clubCode);
    if (!clubMember) {
      logger.error(
        `Player: ${playerId} is not authorized to start the game ${args.gameCode} in club ${game.club.name}`
      );
      throw new Error(
        `Player: ${playerId} is not authorized to start the game ${args.gameCode}`
      );
    }

    if (clubMember.status !== ClubMemberStatus.ACTIVE) {
      logger.error(`The user ${playerId} is not Active in ${args.clubCode}`);
      throw new Error('Unauthorized');
    }
  }

  const handHistory = await HandRepository.getSpecificHandHistory(
    game.id,
    parseInt(args.handNum)
  );
  if (!handHistory) {
    throw new Error('No hand found');
  }
  return await generateHandHistoryData(handHistory, true);
}

export async function getAllHandHistory(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }

  const game = await Cache.getGame(args.gameCode);
  if (!game) {
    throw new Error(`Game ${args.gameCode} is not found`);
  }

  if (game.club) {
    // make sure this player is a club member
    const clubMember = await Cache.getClubMember(playerId, game.club.clubCode);
    if (!clubMember) {
      logger.error(
        `The user ${playerId} is not a member of ${
          args.clubCode
        }, ${JSON.stringify(clubMember)}`
      );
      throw new Error('Unauthorized');
    }

    if (clubMember.status !== ClubMemberStatus.ACTIVE) {
      logger.error(`The user ${playerId} is not Active in ${args.clubCode}`);
      throw new Error('Unauthorized');
    }
  }

  const handHistory = await HandRepository.getAllHandHistory(
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

  const game = await Cache.getGame(args.gameCode);
  if (!game) {
    throw new Error(`Game ${args.gameCode} is not found`);
  }

  if (game.club) {
    const clubMember = await Cache.getClubMember(playerId, game.club.clubCode);
    if (!clubMember) {
      logger.error(
        `Player: ${playerId} is not authorized to start the game ${args.gameCode} in club ${game.club.name}`
      );
      throw new Error(
        `Player: ${playerId} is not authorized to start the game ${args.gameCode}`
      );
    }

    if (clubMember.status !== ClubMemberStatus.ACTIVE) {
      logger.error(`The user ${playerId} is not Active in ${args.clubCode}`);
      throw new Error('Unauthorized');
    }
  }

  const handHistory = await HandRepository.getMyWinningHands(
    game.id,
    player.id,
    args.page
  );
  const hands = new Array<any>();
  for (const hand of handHistory) {
    hands.push(await generateHandHistoryData(hand));
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
  const game = await Cache.getGame(args.gameCode);
  if (!game) {
    throw new Error(`Game ${args.gameCode} is not found`);
  }

  if (game.club) {
    const clubMember = await Cache.getClubMember(playerId, game.club.clubCode);
    if (!clubMember) {
      logger.error(
        `Player: ${playerId} is not authorized to start the game ${args.gameCode} in club ${game.club.name}`
      );
      throw new Error(
        `Player: ${playerId} is not authorized to start the game ${args.gameCode}`
      );
    }

    if (clubMember.status !== ClubMemberStatus.ACTIVE) {
      logger.error(`The user ${playerId} is not Active in ${args.clubCode}`);
      throw new Error('Unauthorized');
    }
  }

  const handHistory = await HandRepository.getSpecificHandHistory(
    game.id,
    parseInt(args.handNum)
  );
  if (!handHistory) {
    logger.error(`The hand ${args.handNum} is not found`);
    throw new Error('Hand not found');
  }

  const resp = await HandRepository.saveStarredHand(
    game.id,
    args.handNum,
    player.id,
    handHistory
  );
  return resp;
}
