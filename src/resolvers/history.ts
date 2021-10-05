import {HistoryRepository} from '@src/repositories/history';
import {GameType} from '@src/entity/types';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache/index';

const logger = getLogger('resolvers::history');
export async function completedGame(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    const gameHistoryData = await HistoryRepository.getGameHistoryByGameCode(
      playerId,
      gameCode
    );

    gameHistoryData.gameType = GameType[gameHistoryData.gameType];
    if (gameHistoryData.stackStat) {
      gameHistoryData.stackStat = gameHistoryData.stackStat.map(x => {
        return {
          handNum: x.hand,
          before: x.playerStack.b,
          after: x.playerStack.a,
        };
      });
    }
    return gameHistoryData;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error('Failed to retreive game history data');
  }
}

export async function gameHistory(playerId: string, clubCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    let club;
    if (clubCode) {
      const clubMember = await Cache.getClubMember(playerId, clubCode);
      if (!clubMember) {
        logger.error(`Player: ${playerId} is not a club member`);
        throw new Error(`Player: ${playerId} is not a club member`);
      }
      club = await Cache.getClub(clubCode);
    }
    const gameHistoryData = await HistoryRepository.getGameHistory(
      playerId,
      club
    );

    const gameHistory = gameHistoryData.map(data => {
      const res: any = data as any;
      res.gameType = GameType[data.gameType];
      if (data.stackStat) {
        res.stackStat = data.stackStat.map(x => {
          return {
            handNum: x.hand,
            before: x.playerStack.b,
            after: x.playerStack.a,
          };
        });
      }
      return res;
    });
    return gameHistory;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error('Failed to retreive game history data');
  }
}

export async function playersInGame(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.clubCode) {
      const clubMember = await Cache.getClubMember(playerId, game.clubCode);
      if (!clubMember) {
        logger.error(
          `Player: ${playerId} is not authorized to start the game ${gameCode} in club ${game.clubName}`
        );
        throw new Error(
          `Player: ${playerId} is not authorized to start the game ${gameCode}`
        );
      }
    }
    const playersInGame = await HistoryRepository.getPlayersInGame(game.id);
    if (!playersInGame) {
      logger.error(`No player in game found for gameId ${game.id}`);
      throw new Error(`No player in game found for gameId ${game.id}`);
    }

    return playersInGame;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error('Failed to retreive game history data');
  }
}

const resolvers: any = {
  Query: {
    gameHistory: async (parent, args, ctx, info) => {
      return gameHistory(ctx.req.playerId, args.clubCode);
    },
    completedGame: async (parent, args, ctx, info) => {
      return completedGame(ctx.req.playerId, args.gameCode);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
