import {HandRepository} from '@src/repositories/hand';
import {HandHistory} from '@src/entity/history/hand';
import {WonAtStatus, GameType, ClubMemberStatus} from '@src/entity/types';
import {PlayerRepository} from '@src/repositories/player';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache';
import {Player} from '@src/entity/player/player';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import _ from 'lodash';
import * as lz from 'lzutf8';

import {getGameRepository} from '@src/repositories';
import {HistoryRepository} from '@src/repositories/history';
import {GameNotFoundError, UnauthorizedError} from '@src/errors';
import {GameRepository} from '@src/repositories/game';
import {GameHistory} from '@src/entity/history/game';
import {RewardRepository} from '@src/repositories/reward';

const logger = getLogger('resolvers::hand');

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
    sharedHand: async (parent, args, ctx, info) => {
      return await sharedHand(ctx.req.playerId, args);
    },
    sharedHands: async (parent, args, ctx, info) => {
      return await sharedHands(ctx.req.playerId, args);
    },
    bookmarkedHands: async (parent, args, ctx, info) => {
      return await bookmarkedHands(ctx.req.playerId, args);
    },
    bookmarkedHandsByGame: async (parent, args, ctx, info) => {
      return await bookmarkedHandsByGame(ctx.req.playerId, args);
    },
    searchHands: async (parent, args, ctx, info) => {
      return await searchHands(ctx.req.playerId, args);
    },
  },
  Mutation: {
    shareHand: async (parent, args, ctx, info) => {
      return await shareHand(ctx.req.playerId, args);
    },
    bookmarkHand: async (parent, args, ctx, info) => {
      return await bookmarkHand(ctx.req.playerId, args);
    },
    removeBookmark: async (parent, args, ctx, info) => {
      return await removeBookmark(ctx.req.playerId, args);
    },
  },
};

export function getResolvers() {
  return resolvers;
}

async function generateHandHistoryData(
  handHistory: HandHistory,
  requestingPlayer: Player,
  isAdmin: boolean,
  includeData?: boolean
) {
  const handTime = Math.round(
    (handHistory.timeEnded.getTime() - handHistory.timeStarted.getTime()) / 1000
  );
  let playersInHand = new Array<number>();
  let authorized = isAdmin;
  if (!isAdmin && handHistory.players != null) {
    if (handHistory.players !== '') {
      playersInHand = _.map(JSON.parse(handHistory.players), x => parseInt(x));
    }
    const playerId = requestingPlayer.id;
    if (playersInHand.indexOf(playerId) !== -1) {
      authorized = true;
    }
  }

  authorized = true;
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
    playersInHand: playersInHand,
    summary: handHistory.summary,
    authorized: authorized,
    data: handHistory.data,
  };
  if (includeData && !ret.data) {
    if (!authorized) {
      ret.data = null;
    } else {
      ret.data = JSON.parse(HandRepository.getHandData(handHistory));
    }
  }
  return ret;
}

export async function getLastHandHistory(playerId: string, args: any) {
  if (!playerId) {
    console.log('Last hand history unauthorized');
    throw new Error('Unauthorized');
  }

  let isLiveGame = false;
  let historyGame: GameHistory | undefined;
  let gameId: number = 0;
  let clubCode: string | undefined;
  const liveGame = await Cache.getGame(args.gameCode);
  if (liveGame) {
    isLiveGame = true;
    // live games
    if (!(await GameRepository.didPlayInGame(args.gameCode, playerId))) {
      logger.error(
        `[${args.gameCode}] Player: ${playerId} did not play the game`
      );
      throw new UnauthorizedError();
    }
    clubCode = liveGame.clubCode;
    gameId = liveGame.id;
  } else {
    historyGame = await HistoryRepository.getHistoryGame(args.gameCode);
    if (!historyGame) {
      throw new GameNotFoundError(args.gameCode);
    }
    gameId = historyGame.gameId;
    clubCode = historyGame.clubCode;
    // history game
    if (!(await HistoryRepository.didPlayInGame(args.gameCode, playerId))) {
      logger.error(
        `[${args.gameCode}] Player: ${playerId} did not play the game`
      );
      throw new UnauthorizedError();
    }
  }

  // if (!game) {
  //   throw new Error(`Game ${args.gameCode} is not found`);
  // }
  const player = await Cache.getPlayer(playerId);
  if (clubCode) {
    const clubMember = await Cache.getClubMember(playerId, clubCode);
    if (!clubMember) {
      logger.error(
        `Player: ${playerId} is not authorized to start the game ${args.gameCode} in club ${clubCode}`
      );
      throw new Error(
        `Player: ${playerId} is not authorized to start the game ${args.gameCode}`
      );
    }

    if (clubMember.status !== ClubMemberStatus.ACTIVE) {
      logger.error(`The user ${playerId} is not Active in ${args.clubCode}`);
      console.log('user is not active in the club');
      throw new Error('Unauthorized');
    }
  }

  // if (!(await HistoryRepository.didPlayInGame(game.gameCode, playerId))) {
  //   console.log('player did not play the game');
  //   throw new UnauthorizedError();
  // }

  const handHistory = await HandRepository.getLastHandHistory(gameId);
  if (!handHistory) {
    return null;
  }
  return await generateHandHistoryData(handHistory, player, true);
}

export async function getSpecificHandHistory(playerId: string, args: any) {
  if (!playerId) {
    console.log('getSpecificHandHistory unauthorized');
    throw new Error('Unauthorized');
  }
  const player = await Cache.getPlayer(playerId);
  const liveGame = await Cache.getGame(args.gameCode);
  let historyGame: GameHistory | undefined;
  let clubCode = '';
  let gameId = 0;
  if (!liveGame) {
    historyGame = await HistoryRepository.getHistoryGame(args.gameCode);
    if (!historyGame) {
      throw new GameNotFoundError(args.gameCode);
    }
    clubCode = historyGame.clubCode;
    gameId = historyGame.gameId;
  } else {
    gameId = liveGame.id;
    clubCode = liveGame.clubCode;
  }
  let authorized = false;
  if (clubCode) {
    // make sure this player is a club member
    const clubMember = await Cache.getClubMember(playerId, clubCode);
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
    if (clubMember.isManager || clubMember.isOwner) {
      authorized = true;
    }
  }
  if (
    liveGame &&
    (liveGame.hostUuid === player.uuid || liveGame.startedBy === player.id)
  ) {
    authorized = true;
  } else if (historyGame && historyGame.startedBy === player.id) {
    authorized = true;
  }

  const handHistory = await HandRepository.getSpecificHandHistory(
    gameId,
    args.handNum
  );
  if (!handHistory) {
    throw new Error('No hand found');
  }
  return await generateHandHistoryData(handHistory, player, authorized, true);
}

export async function getAllHandHistory(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }

  const liveGame = await Cache.getGame(args.gameCode);
  let historyGame: GameHistory | undefined;
  let clubCode = '';
  let gameId = 0;
  if (!liveGame) {
    historyGame = await HistoryRepository.getHistoryGame(args.gameCode);
    if (!historyGame) {
      throw new GameNotFoundError(args.gameCode);
    }
    clubCode = historyGame.clubCode;
    gameId = historyGame.gameId;
  } else {
    gameId = liveGame.id;
    clubCode = liveGame.clubCode;
  }
  const player = await Cache.getPlayer(playerId);
  let authorized = false;
  if (clubCode) {
    // make sure this player is a club member
    const clubMember = await Cache.getClubMember(playerId, clubCode);
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
    if (clubMember.isManager || clubMember.isOwner) {
      authorized = true;
    }
  }
  if (
    liveGame &&
    (liveGame.hostUuid === player.uuid || liveGame.startedBy === player.id)
  ) {
    authorized = true;
  } else if (historyGame && historyGame.startedBy === player.id) {
    authorized = true;
  }
  const handHistory = await HandRepository.getAllHandHistory(gameId, args.page);
  const hands = new Array<any>();
  for (const hand of handHistory) {
    hands.push(await generateHandHistoryData(hand, player, authorized));
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

  const liveGame = await Cache.getGame(args.gameCode);
  let historyGame: GameHistory | undefined;
  let clubCode = '';
  let gameId = 0;
  if (!liveGame) {
    historyGame = await HistoryRepository.getHistoryGame(args.gameCode);
    if (!historyGame) {
      throw new GameNotFoundError(args.gameCode);
    }
    clubCode = historyGame.clubCode;
    gameId = historyGame.gameId;
  } else {
    gameId = liveGame.id;
    clubCode = liveGame.clubCode;
  }
  let authorized = false;
  if (clubCode) {
    // make sure this player is a club member
    const clubMember = await Cache.getClubMember(playerId, clubCode);
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
    if (clubMember.isManager || clubMember.isOwner) {
      authorized = true;
    }
  }
  if (
    liveGame &&
    (liveGame.hostUuid === player.uuid || liveGame.startedBy === player.id)
  ) {
    authorized = true;
  } else if (historyGame && historyGame.startedBy === player.id) {
    authorized = true;
  }

  const handHistory = await HandRepository.getMyWinningHands(
    gameId,
    player.id,
    args.page
  );
  const hands = new Array<any>();
  for (const hand of handHistory) {
    hands.push(await generateHandHistoryData(hand, player, authorized));
  }

  return hands;
}

export async function shareHand(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  try {
    if (!args.gameCode) {
      errors.push('gameCode is missing');
    }
    if (!args.clubCode) {
      errors.push('clubCode is missing');
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
  const player = await Cache.getPlayer(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }

  let gameId = 0;
  let gameType = GameType.UNKNOWN;
  let gameCode = '';
  let clubCode = '';
  const liveGame = await Cache.getGame(args.gameCode);
  if (liveGame) {
    clubCode = liveGame.clubCode;
    // live game is found
    if (!(await GameRepository.didPlayInGame(args.gameCode, playerId))) {
      throw new Error(
        `Player: ${playerId} is not in the game: ${args.gameCode}`
      );
    }
    gameId = liveGame.id;
    gameType = liveGame.gameType;
    gameCode = liveGame.gameCode;
  } else {
    // history game
    const historyGame = await HistoryRepository.getHistoryGame(args.gameCode);
    if (!historyGame) {
      throw new GameNotFoundError(args.gameCode);
    }
    clubCode = historyGame.clubCode;
    gameId = historyGame.gameId;
    gameType = historyGame.gameType;
    gameCode = historyGame.gameCode;
    // did player play this game
    if (!(await HistoryRepository.didPlayInGame(args.gameCode, playerId))) {
      throw new Error(
        `Player: ${playerId} is not in the game: ${args.gameCode}`
      );
    }
  }

  const handHistory = await HandRepository.getSpecificHandHistory(
    gameId,
    parseInt(args.handNum)
  );
  if (!handHistory) {
    logger.error(`The hand ${args.handNum} is not found`);
    throw new Error('Hand not found');
  }
  const club = await Cache.getClub(clubCode);
  if (!club) {
    throw new Error(`Club ${clubCode} is not found`);
  }

  const resp = await HandRepository.shareHand(
    gameCode,
    gameType,
    player,
    club,
    handHistory
  );
  return resp;
}

export async function bookmarkHand(playerId: string, args: any) {
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
  const player = await Cache.getPlayer(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }

  let gameId = 0;
  let gameType = GameType.UNKNOWN;
  let gameCode = '';
  const liveGame = await Cache.getGame(args.gameCode);
  if (liveGame) {
    // live game is found
    if (!(await GameRepository.didPlayInGame(args.gameCode, playerId))) {
      throw new Error(
        `Player: ${playerId} is not in the game: ${args.gameCode}`
      );
    }
    gameId = liveGame.id;
    gameType = liveGame.gameType;
    gameCode = liveGame.gameCode;
  } else {
    // history game
    const historyGame = await HistoryRepository.getHistoryGame(args.gameCode);
    if (!historyGame) {
      throw new GameNotFoundError(args.gameCode);
    }
    gameId = historyGame.gameId;
    gameType = historyGame.gameType;
    gameCode = historyGame.gameCode;
    // did player play this game
    if (!(await HistoryRepository.didPlayInGame(args.gameCode, playerId))) {
      throw new Error(
        `Player: ${playerId} is not in the game: ${args.gameCode}`
      );
    }
  }

  const handHistory = await HandRepository.getSpecificHandHistory(
    gameId,
    parseInt(args.handNum)
  );
  if (!handHistory) {
    logger.error(`The hand ${args.handNum} is not found`);
    throw new Error('Hand not found');
  }

  const resp = await HandRepository.bookmarkHand(
    gameCode,
    gameType,
    player,
    handHistory
  );
  return resp;
}

export async function sharedHand(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  try {
    if (!args.id) {
      errors.push('sharedHand id is missing');
    }
    if (!args.clubCode) {
      errors.push('clubCode is missing');
    }
  } catch (err) {
    throw new Error('Internal server error');
  }

  if (errors.length) {
    throw new Error(JSON.stringify(errors));
  }
  const player = await Cache.getPlayer(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }

  const club = await Cache.getClub(args.clubCode);
  if (!club) {
    throw new Error(`Club ${args.clubCode} is not found`);
  }
  const clubMember = await Cache.getClubMember(playerId, club.clubCode);
  if (!clubMember) {
    logger.error(
      `Player: ${playerId} is not an active member in club ${club.name}`
    );
    throw new Error(
      `Player: ${playerId} is not an active member in club ${club.name}`
    );
  }

  const resp = await HandRepository.sharedHand(args.id);
  return resp;
}

export async function sharedHands(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }

  const player = await Cache.getPlayer(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }
  const club = await Cache.getClub(args.clubCode);
  if (!club) {
    throw new Error(`Club ${args.clubCode} is not found`);
  }
  const clubMember = await Cache.getClubMember(playerId, club.clubCode);
  if (!clubMember) {
    logger.error(
      `Player: ${playerId} is not an active member in club ${club.name}`
    );
    throw new Error(
      `Player: ${playerId} is not an active member in club ${club.name}`
    );
  }

  const resp = await HandRepository.sharedHands(club);
  return resp;
}

export async function bookmarkedHands(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }

  const player = await Cache.getPlayer(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }

  const resp = await HandRepository.bookmarkedHands(player);
  return resp;
}

export async function bookmarkedHandsByGame(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }

  const player = await Cache.getPlayer(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }

  const resp = await HandRepository.bookmarkedHandsByGame(
    player,
    args.gameCode
  );
  return resp;
}

export async function searchHands(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }

  const player = await Cache.getPlayer(playerId);
  if (!player) {
    logger.error(`Player ${playerId} is not found`);
    throw new Error('Unauthorized');
  }

  if (!args.clubCode) {
    logger.error(`clubCode not provided`);
    throw new Error(`Invalid argument`);
  }

  const clubMember = await Cache.getClubMember(playerId, args.clubCode);
  if (!clubMember) {
    logger.error(`Player ${playerId} is not a member of club ${args.clubCode}`);
    throw new Error(`Unauthorized`);
  }

  if (!(clubMember.isOwner || clubMember.isManager)) {
    logger.error(
      `Player ${playerId} is not owner or manager of club ${args.clubCode}`
    );
    throw new Error(`Unauthorized`);
  }

  const resp = await RewardRepository.searchHighRankHands(
    args.clubCode,
    args.startDate,
    args.endDate,
    args.minRank,
    args.gameTypes
  );
  return resp;
}

export async function removeBookmark(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }

  const player = await Cache.getPlayer(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }

  const resp = await HandRepository.removeBookmark(player, args.bookmarkId);
  return resp;
}
