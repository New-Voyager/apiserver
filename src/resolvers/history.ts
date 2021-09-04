import {HistoryRepository} from '@src/repositories/history';
import {GameType} from '@src/entity/types';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache/index';

const logger = getLogger('resolvers::history');

export async function gameHistory(playerId: string, gameCode: string) {
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
    const gameHistoryData = await HistoryRepository.getGameHistory(
      playerId,
      game.clubId
    );
    const gameHistory = new Array<any>();
    if (!gameHistoryData) {
      logger.error(`No game history found for gameId ${game.id}`);
      throw new Error(`No game history found for gameId ${game.id}`);
    }

    gameHistoryData.map(data => {
      const res: any = data as any;
      res.gameType = GameType[data.gameType];
      gameHistory.push(res);
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

const resolvers: any = {};

export function getResolvers() {
  return resolvers;
}
