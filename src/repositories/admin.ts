import {getHistoryConnection, getHistoryManager, getHistoryRepository} from '.';
import {GameHistory} from '@src/entity/history/game';
import {PlayerGameStats} from '@src/entity/history/stats';
import {HandHistory} from '@src/entity/history/hand';
import {getLogger} from '@src/utils/log';

const logger = getLogger('repositories::admin');

class AdminRepositoryImpl {
  constructor() {}

  public async postProcessGames(req: any, resp: any) {
    logger.info('Starting post processing');
    const startTime = performance.now();

    const repo = getHistoryRepository(GameHistory);
    const allGames = await repo.find({status: 4, dataAggregated: false});
    const processedGameIds: Array<number> = [];
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
            playerMap[key].wentToShowDown += stats[key].wentToShowdown ? 1 : 0;
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
          repo.update(
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
    resp.status(200).send({
      processedGameIds: processedGameIds,
    });
  }
}

export const AdminRepository = new AdminRepositoryImpl();
