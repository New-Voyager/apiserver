import {EntityManager, Repository, getRepository} from 'typeorm';
import {v4 as uuidv4} from 'uuid';
import {Player} from '@src/entity/player';
import {PlayerGameStats, PlayerHandStats} from '@src/entity/stats';
import {PokerGame, PokerGameUpdates} from '@src/entity/game';
import {isArray} from 'lodash';
import {loggers} from 'winston';
import {getLogger} from '@src/utils/log';

const logger = getLogger('Stats');
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
    await Promise.all(updates);
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
}

export const StatsRepository = new StatsRepositoryImpl();
