import {Cache} from '@src/cache';

import {
  getGameManager,
  getGameRepository,
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
import * as lz from 'lzutf8';
import {DigitalOcean} from '@src/digitalocean';
import {getGameCodeForClub} from '@src/utils/uniqueid';
import {
  NextHandUpdates,
  PokerGame,
  PokerGameSeatInfo,
  PokerGameSettings,
  PokerGameUpdates,
} from '@src/entity/game/game';
import {
  HostSeatChangeProcess,
  PlayerSeatChangeProcess,
} from '@src/entity/game/seatchange';
import {HighHand} from '@src/entity/game/reward';

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
      playerStats[key].totalHands++;
    }
    for (const key in playersHandStats.playerStats) {
      const stats = playersHandStats.playerStats;
      playerStats[key].wentToShowDown += stats[key].wentToShowdown ? 1 : 0;
      playerStats[key].wonAtShowDown += stats[key].wonChipsAtShowdown ? 1 : 0;
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
    const envAbortThreshold = parseInt(
      process.env.POST_PROCESSING_ABORT_THRESHOLD_SEC || ''
    );
    const abortThresholdSec = Number.isInteger(envAbortThreshold)
      ? envAbortThreshold
      : 30;
    const totalStart = Date.now();

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
    let processedGameIds: Array<number> = [];
    for (let gameIdx = 0; gameIdx < processCount; gameIdx++) {
      const gameStart = Date.now();
      const game = allGames[gameIdx];
      logger.info(
        `Aggregating game results for game: ${game.gameId}:${game.gameCode}`
      );
      await getHistoryManager().transaction(
        async transactionalEntityManager => {
          const gameHistoryRepo = transactionalEntityManager.getRepository(
            GameHistory
          );

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
              totalHands: 0,
              headsupDetails: [],
            };
          }
          // iteratre through hand history and aggregate counters
          let totalPlayersInHand = 0;
          for (const handHistory of handHistoryData) {
            if (handHistory.playersStats) {
              await this.aggregateHandStats(handHistory, playerStatsMap);
            }
            const playersInHand = JSON.parse(handHistory.players).length;
            totalPlayersInHand += playersInHand;
            await handHistoryRepo.update(
              {
                gameId: game.gameId,
                handNum: handHistory.handNum,
              },
              {
                playersStats: undefined,
              }
            );

            // number of players in showdown
            let playersInShowdown = 0;
            if (handHistory.showDown && handHistory.playersStats) {
              let playersHandStats = JSON.parse(handHistory.playersStats);
              for (const key in playersHandStats.playerStats) {
                const stats = playersHandStats.playerStats;
                if (stats[key].wentToShowdown) {
                  playersInShowdown++;
                }
              }
            }

            let highRankJson = {};
            if (handHistory.highRank) {
              highRankJson = JSON.parse(handHistory.highRank);
            }
            await StatsRepository.updateClubStats(
              game,
              highRankJson,
              playersInHand,
              playersInShowdown,
              transactionalEntityManager
            );
            await StatsRepository.updateSystemStats(
              game,
              highRankJson,
              playersInHand,
              playersInShowdown,
              transactionalEntityManager
            );
          }
          const gameStatsRepo = transactionalEntityManager.getRepository(
            PlayerGameStats
          );
          // update player game stats
          for (const player of playersInGame) {
            let headsupHandDetails = '[]';
            if (
              playerStatsMap[player.playerId].headsupDetails &&
              playerStatsMap[player.playerId].headsupDetails.length > 0
            ) {
              headsupHandDetails = JSON.stringify(
                playerStatsMap[player.playerId].headsupDetails
              );
            }
            playerStatsMap[
              player.playerId
            ].headsupHandDetails = headsupHandDetails;
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
          await gameHistoryRepo.update(
            {
              gameId: game.gameId,
            },
            {
              dataAggregated: true,
            }
          );
          processedGameIds.push(game.gameId);
        }
      );

      // remove game data from live games db
      await this.removeLiveGamesData(game.gameCode);

      const gameEnd = Date.now();
      logger.info(
        `Game results for game aggregated: ${game.gameId}:${
          game.gameCode
        }. Time taken: ${gameEnd - gameStart} ms.`
      );

      // How much time have we spent so far.
      const totalElapsedMillis = Date.now() - totalStart;
      const abortThresholdMillis = abortThresholdSec * 1000;
      if (totalElapsedMillis > abortThresholdMillis) {
        if (processedGameIds.length < processCount) {
          logger.info(
            `Aggregation aborting batch due to elapsed time (${totalElapsedMillis} ms) > abort threshold (${abortThresholdMillis} ms). ${processedGameIds.length} out of ${processCount} games are processed.`
          );
        }
        break;
      }
    }
    const more = allGames.length > processedGameIds.length;
    const totalTakenSec = (Date.now() - totalStart) / 1000;
    if (processedGameIds.length > 0) {
      logger.info(
        `Aggregated ${processedGameIds.length} games in ${totalTakenSec} seconds. Game IDs: [${processedGameIds}]`
      );
    }
    return {
      more: more,
      aggregated: processedGameIds,
    };
  }

  private async removeLiveGamesData(gameCode: string) {
    await getGameManager().transaction(async transManager => {
      const game = await Cache.getGame(gameCode, true);
      if (!game) {
        return;
      }
      await transManager.delete(PokerGameSeatInfo, {gameCode: gameCode});
      await transManager.delete(PokerGameUpdates, {gameCode: gameCode});
      await transManager.delete(HighHand, {gameId: game.id});
      await transManager.delete(HostSeatChangeProcess, {gameCode: gameCode});
      await transManager.delete(PlayerSeatChangeProcess, {gameCode: gameCode});
      await transManager.delete(PokerGameSettings, {gameCode: gameCode});
      await transManager.delete(NextHandUpdates, {game: {gameCode: gameCode}});

      const gameRepo = transManager.getRepository(PokerGame);
      const playerGameTrackerRepo = transManager.getRepository(
        PlayerGameTracker
      );
      await playerGameTrackerRepo.delete({
        game: {id: game.id},
      });
      await gameRepo.delete({id: game.id});
      await Cache.removeGame(gameCode);
    });
  }
}

export const Aggregation = new AggregationImpl();
