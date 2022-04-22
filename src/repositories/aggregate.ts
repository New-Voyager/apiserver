import {Cache} from '@src/cache';

import {
  getDebugRepository,
  getGameConnection,
  getGameManager,
  getGameRepository,
  getHistoryConnection,
  getHistoryManager,
  getHistoryRepository,
  getUserManager,
} from '.';
import {GameHistory} from '@src/entity/history/game';
import {PlayerGameStats} from '@src/entity/history/stats';
import {HandHistory} from '@src/entity/history/hand';
import {CreditUpdateType, GameStatus} from '@src/entity/types';
import {PlayersInGame} from '@src/entity/history/player';
import {getLogger, errToStr} from '@src/utils/log';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {StatsRepository} from './stats';
import * as lz from 'lzutf8';
import * as zlib from 'zlib';
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
import {EntityManager, UpdateResult} from 'typeorm';
import {getRunProfile, getStoreHandAnalysis, RunProfile} from '@src/server';
import {AdminRepository} from './admin';
import {HandAnalysis} from '@src/entity/debug/handanalyze';
import {GameRepository} from './game';
import {
  ClubMember,
  CreditTracking,
  MemberTipsTracking,
} from '@src/entity/player/club';
import {ClubRepository} from './club';

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
      let handDataLink = '';
      logger.info(
        `Aggregating game results for game: ${game.gameId}:${game.gameCode}`
      );

      // update credit history
      if (game.clubCode) {
        await this.updateCreditHistory(game);
      }

      await getHistoryManager().transaction(
        async transactionalEntityManager => {
          const gameHistoryRepo =
            transactionalEntityManager.getRepository(GameHistory);

          const handHistoryRepo =
            transactionalEntityManager.getRepository(HandHistory);
          const handHistoryData = await handHistoryRepo.find({
            gameId: game.gameId,
          });
          const playersInGameRepo =
            transactionalEntityManager.getRepository(PlayersInGame);
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
          let hands = new Array<any>();
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

            if (!(game.demoGame || game.lobbyGame)) {
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
              await StatsRepository.updateHighRankStats(
                game,
                transactionalEntityManager
              );
            }
            // hand history
            let hand: any = {};
            hand.wonAt = handHistory.wonAt;
            hand.showDown = handHistory.showDown;
            hand.timeStarted = handHistory.timeStarted.toISOString();
            hand.timeEnded = handHistory.timeEnded.toISOString();
            // logger.info(
            //   `Aggregating hand history for game: ${game.gameId}:${game.gameCode} hand data: ${handHistory.data}`
            // );
            hand.data = JSON.parse(handHistory.data.toString());
            hand.totalPot = handHistory.totalPot;
            hand.tips = handHistory.rake;
            hand.playersStack = JSON.parse(handHistory.playersStack);
            hand.summary = JSON.parse(handHistory.summary);
            hand.handNum = handHistory.handNum;
            hands.push(hand);
          }

          if (
            !(
              getRunProfile() == RunProfile.INT_TEST ||
              getRunProfile() == RunProfile.TEST
            )
          ) {
            logger.info(
              `Aggregating hand history for game: ${game.gameId}:${game.gameCode}`
            );
            // aggregate hand history and upload to S3
            handDataLink = await this.aggregateHandHistory(
              transactionalEntityManager,
              game,
              hands
            );
          }

          const gameStatsRepo =
            transactionalEntityManager.getRepository(PlayerGameStats);
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
            playerStatsMap[player.playerId].headsupHandDetails =
              headsupHandDetails;
            delete playerStatsMap[player.playerId].headsupDetails;

            if (!(game.demoGame || game.lobbyGame)) {
              await gameStatsRepo.update(
                {
                  gameId: game.gameId,
                  playerId: player.playerId,
                },
                playerStatsMap[player.playerId]
              );
            }
          }

          if (!(game.demoGame || game.lobbyGame)) {
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
          }

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

      logger.info(
        `Aggregation: Removing live games data: ${game.gameId}:${game.gameCode}`
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
      try {
        // save hand analysis data
        await this.saveHandAnalysis(game.gameCode, handDataLink);
      } catch (err) {}
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

  private async aggregateHandHistory(
    transManager: EntityManager,
    game: GameHistory,
    hands: Array<any>
  ): Promise<string> {
    const gameHistoryRepo = transManager.getRepository(GameHistory);
    const handHistoryRepo = transManager.getRepository(HandHistory);

    // convert hands to string
    const handStr = JSON.stringify(hands);
    let handCompressed = false;
    let handAggregated = false;
    let handDataUrl = '';
    try {
      //const handData = new TextEncoder().encode(handStr);
      var bufferObject = Buffer.from(handStr);
      const compressedData = zlib.deflateSync(bufferObject);
      const decompressedData = zlib.inflateSync(compressedData);
      // const compressedData = lz.compress(handData);
      // const decompressedData = lz.decompress(compressedData);
      if (handStr.toString() === decompressedData.toString()) {
        console.log('Data is equal');
      }
      handDataUrl = await DigitalOcean.uploadHandData(
        game.gameCode,
        compressedData
      );
      handAggregated = true;
      handCompressed = true;
    } catch (err) {
      // caught an error when aggregating the data (ignore it)
      logger.error(`Failed to aggregate hand data. Error: ${errToStr(err)}`);
    }

    // update game history table
    await gameHistoryRepo.update(
      {
        gameId: game.gameId,
      },
      {
        handDataLink: handDataUrl,
        handsDataCompressed: handCompressed,
        handsAggregated: handAggregated,
      }
    );
    await handHistoryRepo.delete({
      gameId: game.gameId,
    });
    return handDataUrl;
  }

  private async updateCreditHistory(gameHistory: GameHistory) {
    if (gameHistory.creditsAggregated) {
      return;
    }
    const game = await GameRepository.getGameByCode(gameHistory.gameCode);
    if (!game) {
      return;
    }

    if (!game.clubId) {
      return;
    }
    const creditChanges = new Array<CreditTracking>();
    const tipUpdates = new Array();
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    const players = await playerGameTrackerRepository.find({
      game: {id: game.id},
    });

    await getUserManager().transaction(async tranManager => {
      for (const playerInGame of players) {
        const playerUuid = playerInGame.playerUuid;
        const clubMember = await Cache.getClubMember(playerUuid, game.clubCode);
        if (clubMember) {
          // update result
          const amount = playerInGame.stack;
          let newCredit: number;

          try {
            newCredit = await ClubRepository.updateCredit(
              playerUuid,
              game.clubCode,
              amount,
              tranManager
            );
          } catch (err) {
            logger.error(
              `Could not update club member credit after game. club: ${
                game.clubCode
              }, member ID: ${clubMember.id}, game: ${
                game.gameCode
              }: ${errToStr(err)}`
            );
            continue;
          }

          const ct = new CreditTracking();
          ct.clubId = game.clubId;
          ct.playerId = playerInGame.playerId;
          ct.updateType = CreditUpdateType.GAME_RESULT;
          ct.gameCode = game.gameCode;
          ct.amount = amount;
          ct.updatedCredits = newCredit;
          ct.tips = playerInGame.rakePaid;
          creditChanges.push(ct);

          // update tips information
          const tipTrack = new MemberTipsTracking();
          tipTrack.clubId = game.clubId;
          tipTrack.playerId = playerInGame.playerId;
          tipTrack.gameEndedAt = game.endedAt;
          tipTrack.gameCode = game.gameCode;
          tipTrack.numberOfHands = playerInGame.noHandsPlayed;
          tipTrack.tipsPaid = playerInGame.rakePaid;
          tipTrack.buyin = playerInGame.buyIn;
          tipTrack.profit = playerInGame.stack - playerInGame.buyIn;
          tipUpdates.push(
            tranManager.getRepository(MemberTipsTracking).save(tipTrack)
          );
        } else {
          logger.error(
            `Could not find club member in cache while updating credit tracker. club: ${game.clubCode}, player: ${playerUuid}`
          );
        }
      }
      if (creditChanges.length > 0) {
        await tranManager.getRepository(CreditTracking).save(creditChanges);
      }

      if (tipUpdates.length > 0) {
        try {
          await Promise.all(tipUpdates);
        } catch (err) {
          logger.error(`Failed to update tips tracking.`);
        }
      }
    });

    await getHistoryRepository(GameHistory).update(
      {
        gameId: gameHistory.gameId,
      },
      {
        creditsAggregated: true,
      }
    );
  }

  private async removeLiveGamesData(gameCode: string) {
    await getGameManager().transaction(async transManager => {
      const game = await Cache.getGame(gameCode, true);
      if (!game) {
        return;
      }
      await transManager.getRepository(NextHandUpdates).delete({
        game: {id: game.id},
      });
      await transManager.delete(PokerGameSeatInfo, {gameCode: gameCode});
      await transManager.delete(PokerGameUpdates, {gameCode: gameCode});
      await transManager.delete(HighHand, {gameId: game.id});
      await transManager.delete(HostSeatChangeProcess, {gameCode: gameCode});
      await transManager.delete(PlayerSeatChangeProcess, {gameCode: gameCode});
      await transManager.delete(PokerGameSettings, {gameCode: gameCode});

      const gameRepo = transManager.getRepository(PokerGame);
      const playerGameTrackerRepo =
        transManager.getRepository(PlayerGameTracker);
      await playerGameTrackerRepo.delete({
        game: {id: game.id},
      });
      await gameRepo.delete({id: game.id});
      await Cache.removeGame(gameCode);
    });
  }

  private async saveHandAnalysis(gameCode: string, handsLink: string) {
    if (!getStoreHandAnalysis()) {
      return;
    }
    try {
      const ret = await AdminRepository.analyzeHands(gameCode);
      const repo = getDebugRepository(HandAnalysis);
      const data = new HandAnalysis();

      data.gameCode = gameCode;
      const gi = ret.game;
      data.handsDealt = gi.handsDealt;
      data.endedAt = new Date(Date.parse(gi.endedAt));
      data.handsLink = handsLink;
      data.balanceMismatch = ret.balanceMismatch;
      data.resultTable = JSON.stringify(ret.result);
      data.pairedBoardsCount = ret.pairedBoards.length;
      data.pairedSecondBoardsCount = ret.pairedSecondBoards.length;
      data.sameHoleCardsCount = ret.game.sameRankHolecards;
      data.straightFlushesCount = ret.game.straightFlushes;
      data.fourOfKindCount = ret.game.fourOfKinds;
      data.fullHouseCount = ret.game.fullHouseHands;
      await repo.save(data);
    } catch (err) {
      logger.error(
        `Failed to save hand analysis data. Error: ${errToStr(err)}`
      );
    }
  }
}

export const Aggregation = new AggregationImpl();
