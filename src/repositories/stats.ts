import {EntityManager, Repository} from 'typeorm';
import {v4 as uuidv4} from 'uuid';
import {Player} from '@src/entity/player/player';
import {
  ClubStats,
  PlayerGameStats,
  PlayerHandStats,
  SystemStats,
} from '@src/entity/history/stats';
import {PokerGame} from '@src/entity/game/game';
import {isArray} from 'lodash';
import {loggers} from 'winston';
import {errToStr, getLogger} from '@src/utils/log';
import {Club} from '@src/entity/player/club';
import {GameType} from '@src/entity/types';
import {Cache} from '@src/cache';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {getHistoryConnection, getHistoryManager, getHistoryRepository} from '.';
import {PlayersInGame} from '@src/entity/history/player';
import {GameHistory} from '@src/entity/history/game';

const logger = getLogger('repositories::stats');
// Odds
// http://people.math.sfu.ca/~alspach/art8.pdf

// Ranking for higher cards
/*
A♣  3♣  2♣  4♣  5♣     10
6♣  3♣  2♣  4♣  5♣     9
3♣  4♣  5♣  6♣  7♣     8
4♣  5♣  6♣  7♣  8♣     7
...
...
...
T♣  J♣  Q♣  K♣  A♣     1

// AAAAx
A♣  A❤  A♦  A♠  2❤     22
A♣  A❤  A♦  A♠  K❤     11

// KKKKx
K♣  K♦  K♠  K❤  2❤     34
K♣  K♦  K♠  K❤  A❤     23

// QQQQx
Q♣  Q♦  Q♠  Q❤  2❤     46
Q♣  Q♦  Q♠  Q❤  A❤     35

// JJJJx
J♣  J♦  J♠  J❤  2❤     58
J♣  J♦  J♠  J❤  A❤     47

// TTTTx
T♣  T♦  T♠  T❤  2❤     70
T♣  T♦  T♠  T❤  A❤     59

// 9999x
9♣  9♦  9♠  9❤  2♠     82
9♣  9♦  9♠  9❤  A♠     71

// 8888x
8♣  8♦  8♠  8❤  A❤     83
8♣  8♦  8♠  8❤  2❤     94

// 7777x
7♣  7♦  7❤  7♠  2❤     106
7♣  7♦  7❤  7♠  A❤     95

// 6666x
6♣  6♦  6❤  6♠  A❤     107
6♣  6♦  6❤  6♠  2❤     118

// 5555x
5♣  5♦  5❤  5♠  2❤     130
5♣  5♦  5❤  5♠  A❤     119

// 4444x
4♣  4♦  4❤  4♠  2❤     142
4♣  4♦  4❤  4♠  A❤     131

// 3333x
3♣  3♦  3❤  3♠  2❤     154
3♣  3♦  3❤  3♠  A❤     143

// 2222x
2♣  2♠  2❤  2♦  3♠     166
2♣  2♠  2❤  2♦  A❤     155
*/

/**
 We maintain separate stats for HOLDEM, PLO and 5 Card PLO

 */

class StatsRepositoryImpl {
  public async newGameStatsRow(
    game: PokerGame,
    player: Player,
    transactionManager?: EntityManager
  ) {
    let repository: Repository<PlayerGameStats>;
    if (transactionManager) {
      repository = transactionManager.getRepository(PlayerGameStats);
    } else {
      repository = getHistoryRepository(PlayerGameStats);
    }
    // player stats record
    const playerStats = new PlayerGameStats();
    playerStats.playerId = player.id;
    playerStats.gameId = game.id;
    await repository.save(playerStats);
  }

  public async updateClubStats(
    game: GameHistory,
    highRank: any,
    playersInHand: number,
    playersInShowdown: number,
    entityManager: EntityManager | undefined
  ) {
    if (game.clubId === null || entityManager === undefined) {
      return;
    }
    const clubStatsRepo = entityManager.getRepository(ClubStats);
    let gameType: GameType = GameType.HOLDEM;
    if (game.gameType === GameType.PLO || game.gameType === GameType.PLO_HILO) {
      gameType = GameType.PLO;
    } else if (
      game.gameType === GameType.FIVE_CARD_PLO ||
      game.gameType === GameType.FIVE_CARD_PLO_HILO
    ) {
      gameType = GameType.FIVE_CARD_PLO;
    }

    await clubStatsRepo
      .createQueryBuilder()
      .update()
      .set({
        totalHands: () => 'total_hands + 1',
        totalPlayersInHand: () => `total_players_in_hand + ${playersInHand}`,
        totalPlayersInShowdown: () =>
          `total_players_in_showdown + ${playersInShowdown}`,
      })
      .where({
        clubId: game.clubId,
        gameType: gameType,
      })
      .execute();

    for await (const seatNo of Object.keys(highRank)) {
      const rank = highRank[seatNo];
      if (rank > 166) {
        continue;
      }

      const props: any = {};

      if (rank >= 155 && rank <= 166) {
        /*
          2♣  2♠  2❤  2♦  3♠     166
          2♣  2♠  2❤  2♦  A❤     155
        */
        props['four2222'] = () => 'four_2222 + 1';
      } else if (rank >= 143 && rank <= 154) {
        /*
        3♣  3♦  3❤  3♠  2❤     154
        3♣  3♦  3❤  3♠  A❤     143
        */
        props['four3333'] = () => 'four_3333 + 1';
      } else if (rank >= 131 && rank <= 142) {
        /*
          4♣  4♦  4❤  4♠  2❤     142
          4♣  4♦  4❤  4♠  A❤     131
        */
        props['four4444'] = () => 'four_4444 + 1';
      } else if (rank >= 119 && rank <= 130) {
        /*
          5♣  5♦  5❤  5♠  2❤     130
          5♣  5♦  5❤  5♠  A❤     119
        */
        props['four5555'] = () => 'four_5555 + 1';
      } else if (rank >= 107 && rank <= 118) {
        /*
          6♣  6♦  6❤  6♠  A❤     107
          6♣  6♦  6❤  6♠  2❤     118
        */
        props['four6666'] = () => 'four_6666 + 1';
      } else if (rank >= 95 && rank <= 106) {
        /*
          7♣  7♦  7❤  7♠  2❤     106
          7♣  7♦  7❤  7♠  A❤     95
        */
        props['four7777'] = () => 'four_7777 + 1';
      } else if (rank >= 83 && rank <= 94) {
        /*
          8♣  8♦  8♠  8❤  A❤     83
          8♣  8♦  8♠  8❤  2❤     94
        */
        props['four8888'] = () => 'four_8888 + 1';
      } else if (rank >= 71 && rank <= 82) {
        /*
          9♣  9♦  9♠  9❤  2♠     82
          9♣  9♦  9♠  9❤  A♠     71
        */
        props['four9999'] = () => 'four_9999 + 1';
      } else if (rank >= 59 && rank <= 70) {
        /*
          T♣  T♦  T♠  T❤  2❤     70
          T♣  T♦  T♠  T❤  A❤     59
        */
        props['fourTTTT'] = () => 'four_tttt + 1';
      } else if (rank >= 47 && rank <= 58) {
        /*
          J♣  J♦  J♠  J❤  2❤     58
          J♣  J♦  J♠  J❤  A❤     47
        */
        props['fourJJJJ'] = () => 'four_jjjj + 1';
      } else if (rank >= 35 && rank <= 46) {
        /*
          Q♣  Q♦  Q♠  Q❤  2❤     46
          Q♣  Q♦  Q♠  Q❤  A❤     35
        */
        props['fourQQQQ'] = () => 'four_qqqq + 1';
      } else if (rank >= 23 && rank <= 34) {
        /*
          K♣  K♦  K♠  K❤  2❤     34
          K♣  K♦  K♠  K❤  A❤     23
        */
        props['fourKKKK'] = () => 'four_kkkk + 1';
      } else if (rank >= 11 && rank <= 22) {
        /*
          A♣  A❤  A♦  A♠  2❤     22
          A♣  A❤  A♦  A♠  K❤     11
        */
        props['fourAAAA'] = () => 'four_aaaa + 1';
      } else if (rank == 10) {
        props['straight5Flush'] = () => 'straight5_flush + 1';
      } else if (rank == 9) {
        props['straight6Flush'] = () => 'straight6_flush + 1';
      } else if (rank == 8) {
        props['straight7Flush'] = () => 'straight7_flush + 1';
      } else if (rank == 7) {
        props['straight8Flush'] = () => 'straight8_flush + 1';
      } else if (rank == 6) {
        props['straight9Flush'] = () => 'straight9_flush + 1';
      } else if (rank == 5) {
        props['straightTFlush'] = () => 'straightt_flush + 1';
      } else if (rank == 4) {
        props['straightJFlush'] = () => 'straightj_flush + 1';
      } else if (rank == 3) {
        props['straightQFlush'] = () => 'straightq_flush + 1';
      } else if (rank == 2) {
        props['straightKFlush'] = () => 'straightk_flush + 1';
      } else if (rank == 1) {
        props['straightAFlush'] = () => 'straighta_flush + 1';
      }

      await clubStatsRepo
        .createQueryBuilder()
        .update()
        .set(props)
        .where({
          clubId: game.clubId,
          gameType: gameType,
        })
        .execute();
    }
  }

  public async updateSystemStats(
    game: GameHistory,
    highRank: any,
    playersInHand: number,
    playersInShowdown: number,
    entityManager: EntityManager
  ) {
    const systemStatsRepo = entityManager.getRepository(SystemStats);
    let gameType: GameType = GameType.HOLDEM;
    if (game.gameType === GameType.PLO || game.gameType === GameType.PLO_HILO) {
      gameType = GameType.PLO;
    } else if (
      game.gameType === GameType.FIVE_CARD_PLO ||
      game.gameType === GameType.FIVE_CARD_PLO_HILO
    ) {
      gameType = GameType.FIVE_CARD_PLO;
    }
    await systemStatsRepo
      .createQueryBuilder()
      .update()
      .set({
        totalHands: () => 'total_hands + 1',
        totalPlayersInHand: () => `total_players_in_hand + ${playersInHand}`,
        totalPlayersInShowdown: () =>
          `total_players_in_showdown + ${playersInShowdown}`,
      })
      .where({
        gameType: gameType,
      })
      .execute();
    for await (const seatNo of Object.keys(highRank)) {
      const rank = highRank[seatNo];
      if (rank > 166) {
        continue;
      }

      const props: any = {};

      if (rank >= 155 && rank <= 166) {
        /*
          2♣  2♠  2❤  2♦  3♠     166
          2♣  2♠  2❤  2♦  A❤     155
        */
        props['four2222'] = () => 'four_2222 + 1';
      } else if (rank >= 143 && rank <= 154) {
        /*
        3♣  3♦  3❤  3♠  2❤     154
        3♣  3♦  3❤  3♠  A❤     143
        */
        props['four3333'] = () => 'four_3333 + 1';
      } else if (rank >= 131 && rank <= 142) {
        /*
          4♣  4♦  4❤  4♠  2❤     142
          4♣  4♦  4❤  4♠  A❤     131
        */
        props['four4444'] = () => 'four_4444 + 1';
      } else if (rank >= 119 && rank <= 130) {
        /*
          5♣  5♦  5❤  5♠  2❤     130
          5♣  5♦  5❤  5♠  A❤     119
        */
        props['four5555'] = () => 'four_5555 + 1';
      } else if (rank >= 107 && rank <= 118) {
        /*
          6♣  6♦  6❤  6♠  A❤     107
          6♣  6♦  6❤  6♠  2❤     118
        */
        props['four6666'] = () => 'four_6666 + 1';
      } else if (rank >= 95 && rank <= 106) {
        /*
          7♣  7♦  7❤  7♠  2❤     106
          7♣  7♦  7❤  7♠  A❤     95
        */
        props['four7777'] = () => 'four_7777 + 1';
      } else if (rank >= 83 && rank <= 94) {
        /*
          8♣  8♦  8♠  8❤  A❤     83
          8♣  8♦  8♠  8❤  2❤     94
        */
        props['four8888'] = () => 'four_8888 + 1';
      } else if (rank >= 71 && rank <= 82) {
        /*
          9♣  9♦  9♠  9❤  2♠     82
          9♣  9♦  9♠  9❤  A♠     71
        */
        props['four9999'] = () => 'four_9999 + 1';
      } else if (rank >= 59 && rank <= 70) {
        /*
          T♣  T♦  T♠  T❤  2❤     70
          T♣  T♦  T♠  T❤  A❤     59
        */
        props['fourTTTT'] = () => 'four_tttt + 1';
      } else if (rank >= 47 && rank <= 58) {
        /*
          J♣  J♦  J♠  J❤  2❤     58
          J♣  J♦  J♠  J❤  A❤     47
        */
        props['fourJJJJ'] = () => 'four_jjjj + 1';
      } else if (rank >= 35 && rank <= 46) {
        /*
          Q♣  Q♦  Q♠  Q❤  2❤     46
          Q♣  Q♦  Q♠  Q❤  A❤     35
        */
        props['fourQQQQ'] = () => 'four_qqqq + 1';
      } else if (rank >= 23 && rank <= 34) {
        /*
          K♣  K♦  K♠  K❤  2❤     34
          K♣  K♦  K♠  K❤  A❤     23
        */
        props['fourKKKK'] = () => 'four_kkkk + 1';
      } else if (rank >= 11 && rank <= 22) {
        /*
          A♣  A❤  A♦  A♠  2❤     22
          A♣  A❤  A♦  A♠  K❤     11
        */
        props['fourAAAA'] = () => 'four_aaaa + 1';
      } else if (rank == 10) {
        props['straight5Flush'] = () => 'straight5_flush + 1';
      } else if (rank == 9) {
        props['straight6Flush'] = () => 'straight6_flush + 1';
      } else if (rank == 8) {
        props['straight7Flush'] = () => 'straight7_flush + 1';
      } else if (rank == 7) {
        props['straight8Flush'] = () => 'straight8_flush + 1';
      } else if (rank == 6) {
        props['straight9Flush'] = () => 'straight9_flush + 1';
      } else if (rank == 5) {
        props['straightTFlush'] = () => 'straightt_flush + 1';
      } else if (rank == 4) {
        props['straightJFlush'] = () => 'straightj_flush + 1';
      } else if (rank == 3) {
        props['straightQFlush'] = () => 'straightq_flush + 1';
      } else if (rank == 2) {
        props['straightKFlush'] = () => 'straightk_flush + 1';
      } else if (rank == 1) {
        props['straightAFlush'] = () => 'straighta_flush + 1';
      }
      await systemStatsRepo
        .createQueryBuilder()
        .update()
        .set(props)
        .where({
          gameType: gameType,
        })
        .execute();
    }
  }

  public async rollupStats(
    gameId: number,
    transactionalEntityManager: EntityManager
  ) {
    try {
      const playerStatsRepo =
        transactionalEntityManager.getRepository(PlayerHandStats);
      const gameStatsRepo =
        transactionalEntityManager.getRepository(PlayerGameStats);
      const rows = await gameStatsRepo.find({
        gameId: gameId,
      });
      const updates = new Array<any>();
      for (const row of rows) {
        let playerStat = await playerStatsRepo.findOne({
          playerId: row.playerId,
        });
        if (!playerStat) {
          playerStat = new PlayerHandStats();
          await playerStatsRepo.save(playerStat);
        }
        let handSummary = playerStat.headsupHandSummary;
        if (!handSummary) {
          handSummary = '{}';
        }
        let headsupDetails = row.headsupHandDetails;
        if (!headsupDetails) {
          headsupDetails = '[]';
        }

        const jsonSummary = JSON.parse(handSummary);
        const jsonDetails = JSON.parse(headsupDetails);
        let jsonDetailsChanged = false;
        if (jsonDetails && isArray(jsonDetails)) {
          for (const headsup of jsonDetails) {
            jsonDetailsChanged = true;
            const playerId = `${headsup['otherPlayer']}`;
            if (!jsonSummary[playerId]) {
              jsonSummary[playerId] = {
                won: 0,
                total: 0,
              };
            }
            jsonSummary[playerId]['won'] += headsup['won'] ? 1 : 0;
            jsonSummary[playerId]['total'] += 1;
          }
        }

        const props = {
          preflopRaise: () => `preflop_raise + ${row.preflopRaise}`,
          postflopRaise: () => `postflop_raise + ${row.postflopRaise}`,
          threeBet: () => `three_bet + ${row.threeBet}`,
          contBet: () => `cont_bet + ${row.contBet}`,
          vpipCount: () => `vpip_count + ${row.vpipCount}`,
          allInCount: () => `allin_count + ${row.allInCount}`,
          wentToShowDown: () => `went_to_showdown + ${row.wentToShowDown}`,
          wonAtShowDown: () => `won_at_showdown + ${row.wonAtShowDown}`,
          wonHeadsupHands: () => `won_headsup_hands + ${row.wonHeadsupHands}`,
          inPreflop: () => `in_preflop + ${row.inPreflop}`,
          inFlop: () => `in_flop + ${row.inFlop}`,
          inTurn: () => `in_turn + ${row.inTurn}`,
          inRiver: () => `in_river + ${row.inRiver}`,
          headsupHands: () => `headsup_hands + ${row.headsupHands}`,
          totalHands: () => `total_hands + ${row.totalHands}`,
        };

        if (jsonDetailsChanged) {
          props['headsupHandSummary'] = JSON.stringify(jsonSummary);
        }

        updates.push(
          playerStatsRepo
            .createQueryBuilder()
            .update()
            .set(props)
            .where({
              playerId: row.playerId,
            })
            .execute()
        );
      }
      await Promise.all(updates);
    } catch (err) {
      logger.error(`Failed to update player stats: ${errToStr(err)}`);
    }
  }

  public async joinedNewGame(player: Player) {
    try {
      const playerStatsRepo = getHistoryRepository(PlayerHandStats);
      await playerStatsRepo
        .createQueryBuilder()
        .update()
        .set({
          totalGames: () => 'total_games + 1',
        })
        .where({
          playerId: player.id,
        })
        .execute();
    } catch (err) {
      logger.error(`Failed to update player stats: ${errToStr(err)}`);
    }
  }

  public async newClubGame(gameType: GameType, clubId: number) {
    try {
      const clubStatsRepo = getHistoryRepository(ClubStats);
      await clubStatsRepo
        .createQueryBuilder()
        .update()
        .set({
          totalGames: () => 'total_games + 1',
        })
        .where({
          clubId: clubId,
          gameType: gameType,
        })
        .execute();
    } catch (err) {
      logger.error(`Failed to update club stats: ${errToStr(err)}`);
    }
  }

  public async newPlayerHandStats(player: Player) {
    const playerStatsRepo = getHistoryRepository(PlayerHandStats);
    const playerStats = new PlayerHandStats();
    playerStats.playerId = player.id;
    await playerStatsRepo.save(playerStats);
  }

  public async newClubStats(
    club: Club,
    historyTransactionManager?: EntityManager
  ) {
    let clubStatsRepo: Repository<ClubStats>;
    if (historyTransactionManager) {
      clubStatsRepo = historyTransactionManager.getRepository(ClubStats);
    } else {
      clubStatsRepo = getHistoryRepository(ClubStats);
    }
    let clubStats = new ClubStats();
    clubStats.gameType = GameType.HOLDEM;
    clubStats.clubId = club.id;
    await clubStatsRepo.save(clubStats);

    clubStats = new ClubStats();
    clubStats.gameType = GameType.PLO;
    clubStats.clubId = club.id;
    await clubStatsRepo.save(clubStats);

    clubStats = new ClubStats();
    clubStats.gameType = GameType.FIVE_CARD_PLO;
    clubStats.clubId = club.id;
    await clubStatsRepo.save(clubStats);
  }

  public async newSystemStats() {
    const systemStatsRepo = getHistoryConnection().getRepository(SystemStats);
    let count = await systemStatsRepo.count({
      gameType: GameType.HOLDEM,
    });
    if (count <= 0) {
      const systemStats = new SystemStats();
      systemStats.gameType = GameType.HOLDEM;
      await systemStatsRepo.save(systemStats);
    }

    count = await systemStatsRepo.count({
      gameType: GameType.PLO,
    });
    if (count <= 0) {
      const systemStats = new SystemStats();
      systemStats.gameType = GameType.PLO;
      await systemStatsRepo.save(systemStats);
    }

    count = await systemStatsRepo.count({
      gameType: GameType.FIVE_CARD_PLO,
    });
    if (count <= 0) {
      const systemStats = new SystemStats();
      systemStats.gameType = GameType.FIVE_CARD_PLO;
      await systemStatsRepo.save(systemStats);
    }
  }

  public async getClubStats(
    gameType: GameType,
    clubCode: string
  ): Promise<any> {
    const clubStatsRepo = getHistoryRepository(ClubStats);
    const club = await Cache.getClub(clubCode);
    const stats = await clubStatsRepo.findOne({
      gameType: gameType,
      clubId: club.id,
    });
    return stats;
  }

  public async getSystemStats(gameType: GameType): Promise<any> {
    const systemStatsRepo = getHistoryRepository(SystemStats);
    const stats = await systemStatsRepo.findOne({
      gameType: gameType,
    });
    return stats;
  }

  public async getPlayerHandStats(playerId: string): Promise<any> {
    const playerHandsRepo = getHistoryRepository(PlayerHandStats);
    const player = await Cache.getPlayer(playerId);
    const playerStatHand = await playerHandsRepo.findOne({
      playerId: player.id,
    });
    return playerStatHand;
  }

  public async getPlayerGameStats(
    playerId: string,
    gameId: number
  ): Promise<PlayerGameStats | undefined> {
    const playerGameRepo = getHistoryRepository(PlayerGameStats);
    const player = await Cache.getPlayer(playerId);
    const playerStatHand = await playerGameRepo.findOne({
      gameId: gameId,
      playerId: player.id,
    });
    return playerStatHand;
  }

  public async gameEnded(
    game: GameHistory,
    players: Array<PlayersInGame>,
    transManager
  ) {
    const playerStatsRepo = transManager.getRepository(PlayerHandStats);
    // get the date
    const date = `${game.startedAt.getFullYear()}-${game.startedAt.getMonth()}-${game.startedAt.getDay()}`;
    try {
      for (const player of players) {
        const playerStat = await playerStatsRepo.findOne({
          playerId: player.playerId,
        });
        if (playerStat) {
          // get recent performance data
          const recentDataJson = playerStat.recentPerformance;
          let recentPerformance = new Array<any>();
          try {
            recentPerformance = JSON.parse(recentDataJson);
          } catch {}
          let found = false;
          const profit = player.stack - player.buyIn;
          for (const perf of recentPerformance) {
            if (perf['date'] == date) {
              if (perf['profit']) {
                perf['profit'] = perf['profit'] + profit;
              } else {
                perf['profit'] = profit;
              }
              found = true;
              break;
            }
          }

          if (!found) {
            const perf = {
              date: date,
              profit: profit,
            };
            recentPerformance.push(perf);

            // if there are more than 20 items, remove the first item
            if (recentPerformance.length > 20) {
              const removeItems = recentPerformance.length - 20;
              recentPerformance = recentPerformance.splice(0, removeItems);
            }
          }

          const perfStr = JSON.stringify(recentPerformance);
          await playerStatsRepo.update(
            {
              playerId: player.playerId,
            },
            {
              recentPerformance: perfStr,
            }
          );
        }
      }
    } catch (err) {
      logger.error(
        `Error when player hand stats data. Error: ${errToStr(err)}`
      );
      throw err;
    }
  }

  public async getPlayerRecentPerformance(player: Player): Promise<string> {
    const playerStatsRepo = getHistoryRepository(PlayerHandStats);
    const playerStat = await playerStatsRepo.findOne({
      playerId: player.id,
    });
    if (!playerStat) {
      return '[]';
    } else {
      return playerStat.recentPerformance;
    }
  }
}

export const StatsRepository = new StatsRepositoryImpl();
