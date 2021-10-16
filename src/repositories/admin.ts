import {
  getGameManager,
  getHistoryConnection,
  getHistoryManager,
  getHistoryRepository,
  getUserManager,
} from '.';
import {GameHistory} from '@src/entity/history/game';
import {
  ClubStats,
  PlayerGameStats,
  PlayerHandStats,
} from '@src/entity/history/stats';
import {HandHistory, HighHandHistory} from '@src/entity/history/hand';
import {errToLogString, getLogger} from '@src/utils/log';
import {performance} from 'perf_hooks';
import {PlayersInGame} from '@src/entity/history/player';
import {
  GameReward,
  GameRewardTracking,
  HighHand,
} from '@src/entity/game/reward';
import {GameServer} from '@src/entity/game/gameserver';
import {
  HostSeatChangeProcess,
  PlayerSeatChangeProcess,
} from '@src/entity/game/seatchange';
import {
  NextHandUpdates,
  PokerGame,
  PokerGameSeatInfo,
  PokerGameSettings,
  PokerGameUpdates,
} from '@src/entity/game/game';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {Announcement} from '@src/entity/player/announcements';
import {ChatText} from '@src/entity/player/chat';
import {Club, ClubMember, ClubMemberStat} from '@src/entity/player/club';
import {
  ClubHostMessages,
  ClubMessageInput,
} from '@src/entity/player/clubmessage';
import {
  CoinConsumeTransaction,
  CoinPurchaseTransaction,
  PlayerCoin,
} from '@src/entity/player/appcoin';
import {Player, PlayerNotes, SavedHands} from '@src/entity/player/player';
import {Promotion} from '@src/entity/player/promotion';
import {PromotionConsumed} from '@src/entity/player/promotion_consumed';
import {Reward} from '@src/entity/player/reward';

const logger = getLogger('repositories::admin');

class AdminRepositoryImpl {
  constructor() {}

  public async checkDbTransaction() {
    await getHistoryManager().transaction(async txnMgr => {
      const historyEntities = [
        ClubStats,
        GameHistory,
        HandHistory,
        HighHandHistory,
        PlayerGameStats,
        PlayerHandStats,
        PlayersInGame,
      ];
      for (const e of historyEntities) {
        await txnMgr.getRepository(e).find({take: 1});
      }
    });
    await getGameManager().transaction(async txnMgr => {
      const gameEntities = [
        GameReward,
        GameRewardTracking,
        GameServer,
        HighHand,
        HostSeatChangeProcess,
        NextHandUpdates,
        PlayerGameTracker,
        PlayerSeatChangeProcess,
        PokerGame,
        PokerGameSeatInfo,
        PokerGameSettings,
        PokerGameUpdates,
      ];
      for (const e of gameEntities) {
        await txnMgr.getRepository(e).find({take: 1});
      }
    });
    await getUserManager().transaction(async txnMgr => {
      const userEntities = [
        Announcement,
        ChatText,
        Club,
        ClubHostMessages,
        ClubMember,
        ClubMemberStat,
        ClubMessageInput,
        CoinConsumeTransaction,
        CoinPurchaseTransaction,
        Player,
        PlayerCoin,
        PlayerNotes,
        Promotion,
        PromotionConsumed,
        Reward,
        SavedHands,
      ];
      for (const e of userEntities) {
        await txnMgr.getRepository(e).find({take: 1});
      }
    });
  }

  public async postProcessGames(req: any, resp: any) {
    const processedGameIds: Array<number> = [];
    try {
      logger.info('Starting post processing');
      const startTime = performance.now();

      const repo = getHistoryRepository(GameHistory);
      const allGames = await repo.find({status: 4, dataAggregated: false});
      allGames.map(async value => {
        await getHistoryManager().transaction(
          async transactionalEntityManager => {
            const handHistoryRepo = transactionalEntityManager.getRepository(
              HandHistory
            );
            const playerStatsFromHandHistory = await handHistoryRepo.find({
              gameId: value.gameId,
            });
            let playerMap = {};
            const playerStats = JSON.parse(
              playerStatsFromHandHistory[0].playersStats
            );
            let counter = 1;
            for (const key in playerStats.playerRound) {
              Object.defineProperty(playerMap, key, {
                value: {
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
                  headsupHandDetails: [],
                },
              });
              const rounds = playerStats.playerRound;
              playerMap[key].inPreflop += rounds[key].preflop;
              playerMap[key].inFlop += rounds[key].flop;
              playerMap[key].inTurn += rounds[key].turn;
              playerMap[key].inRiver += rounds[key].river;
            }
            for (const key in playerStats.playerStats) {
              const stats = playerStats.playerStats;
              playerMap[key].wentToShowDown += stats[key].wentToShowdown
                ? 1
                : 0;
              playerMap[key].headsupHands += stats[key].headsup ? 1 : 0;
              playerMap[key].wonHeadsupHands += stats[key].wonHeadsup ? 1 : 0;
              playerMap[key].preflopRaise += stats[key].preflopRaise ? 1 : 0;
              playerMap[key].postflopRaise += stats[key].postflopRaise ? 1 : 0;
              playerMap[key].threeBet += stats[key].threeBet ? 1 : 0;
              playerMap[key].contBet += stats[key].cbet ? 1 : 0;
              playerMap[key].vpipCount += stats[key].vpip ? 1 : 0;
              playerMap[key].allInCount += stats[key].allin ? 1 : 0;
              if (stats[key].headsup) {
                playerMap[key].headsupHandDetails.push({
                  handNum: counter,
                  otherPlayer: stats[key].headsupPlayer,
                  won: stats[key].wonHeadsup,
                });
                counter++;
              }
              await transactionalEntityManager
                .getRepository(PlayerGameStats)
                .update(
                  {
                    gameId: value.gameId,
                    playerId: parseInt(key),
                  },
                  playerMap[key]
                );
            }
            await repo.update(
              {
                gameId: value.gameId,
              },
              {
                dataAggregated: true,
              }
            );
          }
        );
        processedGameIds.push(value.gameId);
      });

      const endTime = performance.now();
      logger.info(
        `Post processing of ${processedGameIds.length} games took ${
          endTime - startTime
        } ms. Processed game IDs - [${processedGameIds}]`
      );
    } catch (err) {
      logger.error(`Error during post processing: ${errToLogString(err)}`);
      resp.status(500).send({
        processedGameIds: [],
      });
      return;
    }
    resp.status(200).send({
      processedGameIds: processedGameIds,
    });
  }
}

export const AdminRepository = new AdminRepositoryImpl();
