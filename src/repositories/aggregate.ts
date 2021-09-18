import {
  getGameManager,
  getHistoryConnection,
  getHistoryManager,
  getHistoryRepository,
} from '.';
import {GameHistory} from '@src/entity/history/game';
import {PlayerGameStats} from '@src/entity/history/stats';
import {HandHistory} from '@src/entity/history/hand';
import {GameStatus} from '@src/entity/types';
import {PlayersInGame} from '@src/entity/history/player';
import {getLogger} from '@src/utils/log';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {StatsRepository} from './stats';

const BATCH_SIZE = 10;
const logger = getLogger('repositories::aggregate');

class AggregationImpl {
  constructor() {}
  private async aggregateHandStats(handHistory: HandHistory, playerStats: any) {
    let playersHandStats = JSON.parse(handHistory.playersStats);
    for (const key in playersHandStats.playerRound) {
      const rounds = playersHandStats.playerRound;
      playerStats[key].inPreflop += rounds[key].preflop;
      playerStats[key].inFlop += rounds[key].flop;
      playerStats[key].inTurn += rounds[key].turn;
      playerStats[key].inRiver += rounds[key].river;
    }
    for (const key in playersHandStats.playerStats) {
      const stats = playersHandStats.playerStats;
      playerStats[key].wentToShowDown += stats[key].wentToShowdown ? 1 : 0;
      playerStats[key].headsupHands += stats[key].headsup ? 1 : 0;
      playerStats[key].wonHeadsupHands += stats[key].wonHeadsup ? 1 : 0;
      playerStats[key].preflopRaise += stats[key].preflopRaise ? 1 : 0;
      playerStats[key].postflopRaise += stats[key].postflopRaise ? 1 : 0;
      playerStats[key].threeBet += stats[key].threeBet ? 1 : 0;
      playerStats[key].contBet += stats[key].cbet ? 1 : 0;
      playerStats[key].vpipCount += stats[key].vpip ? 1 : 0;
      playerStats[key].allInCount += stats[key].allin ? 1 : 0;
      if (stats[key].headsup) {
        playerStats[key].headsupDetails.push({
          handNum: handHistory.handNum,
          otherPlayer: stats[key].headsupPlayer,
          won: stats[key].wonHeadsup,
        });
      }
    }
  }

  public async postProcessGames(): Promise<any> {
    const repo = getHistoryRepository(GameHistory);

    // process 10 games in a batch
    const allGames = await repo.find({
      where: {
        status: GameStatus.ENDED,
        dataAggregated: false,
      },
      take: BATCH_SIZE + 1,
    });
    let processCount = allGames.length;
    if (processCount > BATCH_SIZE) {
      processCount--;
    }
    for (let gameIdx = 0; gameIdx < processCount; gameIdx++) {
      const game = allGames[gameIdx];
      logger.info(
        `Aggregating game results for game: ${game.gameId}:${game.gameCode}`
      );
      await getHistoryManager().transaction(
        async transactionalEntityManager => {
          const handHistoryRepo = transactionalEntityManager.getRepository(
            HandHistory
          );
          const handHistoryData = await handHistoryRepo.find({
            gameId: game.gameId,
          });
          const playersInGameRepo = transactionalEntityManager.getRepository(
            PlayersInGame
          );
          const playersInGame = await playersInGameRepo.find({
            gameId: game.gameId,
          });
          let playerStatsMap = {};
          for (const player of playersInGame) {
            playerStatsMap[player.playerId] = {
              inPreflop: 0,
              inFlop: 0,
              inTurn: 0,
              inRiver: 0,
              wentToShowDown: 0,
              wonAtShowDown: 0,
              headsupHands: 0,
              wonHeadsupHands: 0,
              preflopRaise: 0,
              postflopRaise: 0,
              threeBet: 0,
              contBet: 0,
              vpipCount: 0,
              allInCount: 0,
              headsupDetails: [],
            };
          }
          // iteratre through hand history and aggregate counters
          for (const handHistory of handHistoryData) {
            this.aggregateHandStats(handHistory, playerStatsMap);
            await handHistoryRepo.update(
              {
                gameId: game.gameId,
                handNum: handHistory.handNum,
              },
              {
                playersStats: undefined,
              }
            );
          }
          const gameStatsRepo = getHistoryRepository(PlayerGameStats);
          // update player game stats
          for (const player of playersInGame) {
            playerStatsMap[player.playerId].headsupHandDetails = JSON.stringify(
              playerStatsMap[player.playerId].headsupDetails
            );
            delete playerStatsMap[player.playerId].headsupDetails;
            await gameStatsRepo.update(
              {
                gameId: game.gameId,
                playerId: player.playerId,
              },
              playerStatsMap[player.playerId]
            );
          }

          // roll up stats
          await StatsRepository.rollupStats(
            game.gameId,
            transactionalEntityManager
          );

          // update player performance
          await StatsRepository.gameEnded(
            game,
            playersInGame,
            transactionalEntityManager
          );

          // data is aggregated for this game
          await repo.update(
            {
              gameId: game.gameId,
            },
            {
              dataAggregated: true,
            }
          );
        }
      );
      logger.info(
        `Game results for game aggregated: ${game.gameId}:${game.gameCode}`
      );
    }
    let more = allGames.length == BATCH_SIZE + 1;

    return {
      more: more,
      aggregated: allGames.map(e => e.gameId),
    };
  }
}

export const Aggregation = new AggregationImpl();
