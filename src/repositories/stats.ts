import {EntityManager, Repository, getRepository} from 'typeorm';
import {v4 as uuidv4} from 'uuid';
import {Player} from '@src/entity/player';
import {
  ClubStats,
  PlayerGameStats,
  PlayerHandStats,
  SystemStats,
} from '@src/entity/stats';
import {PokerGame, PokerGameUpdates} from '@src/entity/game';
import {isArray} from 'lodash';
import {loggers} from 'winston';
import {getLogger} from '@src/utils/log';
import {Club} from '@src/entity/club';
import {GameType} from '@src/entity/types';
import {Cache} from '@src/cache';

const logger = getLogger('Stats');

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
  public newGameStatsRow(
    game: PokerGame,
    player: Player,
    transactionManager?: EntityManager
  ) {
    let repository: Repository<PlayerGameStats>;
    if (transactionManager) {
      repository = transactionManager.getRepository(PlayerGameStats);
    } else {
      repository = getRepository(PlayerGameStats);
    }
    // player stats record
    const playerStats = new PlayerGameStats();
    playerStats.player = player;
    playerStats.game = game;
    repository.save(playerStats);
  }

  public async saveHandStats(
    game: PokerGame,
    handResult: any,
    handNum: number,
    transactionManager?: EntityManager
  ) {
    let repository: Repository<PlayerGameStats>;
    if (transactionManager) {
      repository = transactionManager.getRepository(PlayerGameStats);
    } else {
      repository = getRepository(PlayerGameStats);
    }

    const playerStats = handResult.playerStats;
    if (!playerStats) {
      return;
    }
    const updates = new Array<any>();

    for (const key of Object.keys(playerStats)) {
      const playerId = parseInt(key);
      const playerStat = playerStats[key];

      let headsupRecord;
      if (playerStat.headsup) {
        // treat headsup special, get the existing record and add the count
        const col = await repository
          .createQueryBuilder()
          .where({
            player: {id: playerId},
            game: {id: game.id},
          })
          .select('headsup_hand_details')
          .execute();
        if (!headsupRecord) {
          headsupRecord = [];
        }
        if (
          !col ||
          col.length === 0 ||
          col[0]['headsup_hand_details'] === '[]'
        ) {
          headsupRecord = new Array<any>();
        } else {
          headsupRecord = JSON.parse(col[0]['headsup_hand_details']);
        }

        headsupRecord.push({
          handNum: handNum,
          otherPlayer: parseInt(playerStat.headsupPlayer),
          won: playerStat.wonHeadsup,
        });
      }

      updates.push(
        repository
          .createQueryBuilder()
          .update()
          .set({
            preflopRaise: () =>
              `preflop_raise + ${playerStat.preflopRaise ? 1 : 0}`,
            postflopRaise: () =>
              `postflop_raise + ${playerStat.postflopRaise ? 1 : 0}`,
            threeBet: () => `three_bet + ${playerStat.threeBet ? 1 : 0}`,
            contBet: () => `cont_bet + ${playerStat.contBet ? 1 : 0}`,
            vpipCount: () => `vpip_count + ${playerStat.vpip ? 1 : 0}`,
            allInCount: () => `allin_count + ${playerStat.allin ? 1 : 0}`,
            wentToShowDown: () =>
              `went_to_showdown + ${playerStat.wentToShowdown ? 1 : 0}`,
            wonAtShowDown: () =>
              `won_at_showdown + ${playerStat.wonChipsAtShowdown ? 1 : 0}`,
            wonHeadsupHands: () =>
              `won_headsup_hands + ${playerStat.wonHeadsup ? 1 : 0}`,
            inPreflop: () => `in_preflop + ${playerStat.inPreflop ? 1 : 0}`,
            inFlop: () => `in_flop + ${playerStat.inFlop ? 1 : 0}`,
            inTurn: () => `in_turn + ${playerStat.inTurn ? 1 : 0}`,
            inRiver: () => `in_river + ${playerStat.inRiver ? 1 : 0}`,
            headsupHands: () => `headsup_hands + ${playerStat.headsup ? 1 : 0}`,
            totalHands: () => `total_hands + 1`,
          })
          .where({
            player: {id: playerId},
            game: {id: game.id},
          })
          .execute()
      );
      if (headsupRecord) {
        updates.push(
          repository
            .createQueryBuilder()
            .update()
            .set({
              headsupHandDetails: JSON.stringify(headsupRecord),
            })
            .where({
              player: {id: playerId},
              game: {id: game.id},
            })
            .execute()
        );
      }
    }
    updates.push(this.updateClubStats(game, handResult, transactionManager));
    await Promise.all(updates);
  }

  private async updateClubStats(
    game: PokerGame,
    result: any,
    entityManager: EntityManager | undefined
  ) {
    if (game.club === null || entityManager === undefined) {
      return;
    }
    const clubStatsRepo = entityManager.getRepository(ClubStats);
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

    await clubStatsRepo
      .createQueryBuilder()
      .update()
      .set({
        totalHands: () => `total_hands + 1`,
      })
      .where({
        club: {id: game.club.id},
        gameType: gameType,
      })
      .execute();

    await systemStatsRepo
      .createQueryBuilder()
      .update()
      .set({
        totalHands: () => `total_hands + 1`,
      })
      .where({
        gameType: gameType,
      })
      .execute();

    for await (const seatNo of Object.keys(result.players)) {
      const player = result.players[seatNo];
      const playerId = parseInt(player.id);
      if (player.playedUntil !== 'SHOW_DOWN') {
        continue;
      }
      const rank = player.rank;
      if (rank > 166) {
        continue;
      }

      let props: any = {};

      if (rank >= 155 && rank <= 166) {
        /*
          2♣  2♠  2❤  2♦  3♠     166
          2♣  2♠  2❤  2♦  A❤     155
        */
        props['four2222'] = () => `four_2222 + 1`;
      } else if (rank >= 143 && rank <= 154) {
        /*
        3♣  3♦  3❤  3♠  2❤     154
        3♣  3♦  3❤  3♠  A❤     143
        */
        props['four3333'] = () => `four_3333 + 1`;
      } else if (rank >= 131 && rank <= 142) {
        /*
          4♣  4♦  4❤  4♠  2❤     142
          4♣  4♦  4❤  4♠  A❤     131
        */
        props['four4444'] = () => `four_4444 + 1`;
      } else if (rank >= 119 && rank <= 130) {
        /*
          5♣  5♦  5❤  5♠  2❤     130
          5♣  5♦  5❤  5♠  A❤     119
        */
        props['four5555'] = () => `four_5555 + 1`;
      } else if (rank >= 107 && rank <= 118) {
        /*
          6♣  6♦  6❤  6♠  A❤     107
          6♣  6♦  6❤  6♠  2❤     118
        */
        props['four6666'] = () => `four_6666 + 1`;
      } else if (rank >= 95 && rank <= 106) {
        /*
          7♣  7♦  7❤  7♠  2❤     106
          7♣  7♦  7❤  7♠  A❤     95
        */
        props['four7777'] = () => `four_7777 + 1`;
      } else if (rank >= 83 && rank <= 94) {
        /*
          8♣  8♦  8♠  8❤  A❤     83
          8♣  8♦  8♠  8❤  2❤     94
        */
        props['four8888'] = () => `four_8888 + 1`;
      } else if (rank >= 71 && rank <= 82) {
        /*
          9♣  9♦  9♠  9❤  2♠     82
          9♣  9♦  9♠  9❤  A♠     71
        */
        props['four9999'] = () => `four_9999 + 1`;
      } else if (rank >= 59 && rank <= 70) {
        /*
          T♣  T♦  T♠  T❤  2❤     70
          T♣  T♦  T♠  T❤  A❤     59
        */
        props['fourTTTT'] = () => `four_tttt + 1`;
      } else if (rank >= 47 && rank <= 58) {
        /*
          J♣  J♦  J♠  J❤  2❤     58
          J♣  J♦  J♠  J❤  A❤     47
        */
        props['fourJJJJ'] = () => `four_jjjj + 1`;
      } else if (rank >= 35 && rank <= 46) {
        /*
          Q♣  Q♦  Q♠  Q❤  2❤     46
          Q♣  Q♦  Q♠  Q❤  A❤     35
        */
        props['fourQQQQ'] = () => `four_qqqq + 1`;
      } else if (rank >= 23 && rank <= 34) {
        /*
          K♣  K♦  K♠  K❤  2❤     34
          K♣  K♦  K♠  K❤  A❤     23
        */
        props['fourKKKK'] = () => `four_kkkk + 1`;
      } else if (rank >= 11 && rank <= 22) {
        /*
          A♣  A❤  A♦  A♠  2❤     22
          A♣  A❤  A♦  A♠  K❤     11
        */
        props['fourAAAA'] = () => `four_aaaa + 1`;
      } else if (rank == 10) {
        props['straight5Flush'] = () => `straight5_flush + 1`;
      } else if (rank == 9) {
        props['straight6Flush'] = () => `straight6_flush + 1`;
      } else if (rank == 8) {
        props['straight7Flush'] = () => `straight7_flush + 1`;
      } else if (rank == 7) {
        props['straight8Flush'] = () => `straight8_flush + 1`;
      } else if (rank == 6) {
        props['straight9Flush'] = () => `straight9_flush + 1`;
      } else if (rank == 5) {
        props['straightTFlush'] = () => `straightt_flush + 1`;
      } else if (rank == 4) {
        props['straightJFlush'] = () => `straightj_flush + 1`;
      } else if (rank == 3) {
        props['straightQFlush'] = () => `straightq_flush + 1`;
      } else if (rank == 2) {
        props['straightKFlush'] = () => `straightk_flush + 1`;
      } else if (rank == 1) {
        props['straightAFlush'] = () => `straighta_flush + 1`;
      }

      await clubStatsRepo
        .createQueryBuilder()
        .update()
        .set(props)
        .where({
          club: {id: game.club.id},
          gameType: gameType,
        })
        .execute();

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

  public async rollupStats(game: PokerGame) {
    try {
      const playerStatsRepo = getRepository(PlayerHandStats);
      const gameStatsRepo = getRepository(PlayerGameStats);
      const rows = await gameStatsRepo.find({
        game: {id: game.id},
      });
      const updates = new Array<any>();
      for (const row of rows) {
        let playerStat = await playerStatsRepo.findOne({
          player: {id: row.player.id},
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
              player: {id: row.player.id},
            })
            .execute()
        );
      }
      await Promise.all(updates);
    } catch (err) {
      logger.error(`Failed to update player stats: ${err.toString()}`);
    }
  }

  public async newPlayerHandStats(player: Player) {
    const playerStatsRepo = getRepository(PlayerHandStats);
    const playerStats = new PlayerHandStats();
    playerStats.player = player;
    await playerStatsRepo.save(playerStats);
  }

  public async newClubStats(
    club: Club,
    transactionEntityManager: EntityManager
  ) {
    const clubStatsRepo = transactionEntityManager.getRepository(ClubStats);
    let clubStats = new ClubStats();
    clubStats.gameType = GameType.HOLDEM;
    clubStats.club = club;
    await clubStatsRepo.save(clubStats);

    clubStats = new ClubStats();
    clubStats.gameType = GameType.PLO;
    clubStats.club = club;
    await clubStatsRepo.save(clubStats);

    clubStats = new ClubStats();
    clubStats.gameType = GameType.FIVE_CARD_PLO;
    clubStats.club = club;
    await clubStatsRepo.save(clubStats);
  }

  public async newSystemStats() {
    const systemStatsRepo = getRepository(SystemStats);
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
    const clubStatsRepo = getRepository(ClubStats);
    const club = await Cache.getClub(clubCode);
    const stats = await clubStatsRepo.findOne({
      gameType: gameType,
      club: {id: club.id},
    });
    return stats;
  }

  public async getPlayerHandStats(playerId: string): Promise<any> {
    const playerHandsRepo = getRepository(PlayerHandStats);
    const player = await Cache.getPlayer(playerId);
    const playerStatHand = await playerHandsRepo.findOne({
      player: {id: player.id},
    });
    return playerStatHand;
  }

  public async getPlayerGameStats(
    playerId: string,
    gameCode: string
  ): Promise<any> {
    const playerGameRepo = getRepository(PlayerGameStats);
    const player = await Cache.getPlayer(playerId);
    const game = await Cache.getGame(gameCode);
    const playerStatHand = await playerGameRepo.findOne({
      game: {id: game.id},
      player: {id: player.id},
    });
    return playerStatHand;
  }
}

export const StatsRepository = new StatsRepositoryImpl();
