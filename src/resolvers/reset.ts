import {EntityManager, getConnection, SelectQueryBuilder} from 'typeorm';
import {getManager} from 'typeorm';
import {getLogger} from '@src/utils/log';
import {isGameServerEnabled} from '@src/gameserver';
import {startTimer} from '@src/timer';
import {Cache} from '@src/cache';
import {
  getGameManager,
  getHistoryManager,
  getUserManager,
} from '@src/repositories';

const logger = getLogger('resolvers::reset');

const resolvers: any = {
  Mutation: {
    resetDB: async (parent, args, ctx, info) => {
      // if (ctx.req.playerId !== 'TEST_USER') {
      //   throw new Error('Unauthorized');
      // }
      // delete all the entries
      const resp = await resetDB();
      logger.info('Database reset is complete');
      return resp;
    },

    resetGames: async (parent, args, ctx, info) => {
      //if (ctx.req.playerId !== 'TEST_USER') {
      //  throw new Error('Unauthorized');
      //}
      // delete all the entries
      const resp = await resetGames();
      logger.info('Removes all games');
      return resp;
    },

    testTimer: async (parent, args, ctx, info) => {
      const t = new Date();
      t.setSeconds(t.getSeconds() + args.exp);
      await startTimer(args.gameID, args.playerId, args.purpose, t);
      return true;
    },
  },
};

export async function resetGames() {
  await getGameManager().transaction(async transactionEntityManager => {
    await deleteAll('next_hand_updates', transactionEntityManager);
    await deleteAll('player_game_tracker', transactionEntityManager);
    await deleteAll('poker_game_updates', transactionEntityManager);
    await deleteAll('poker_game_settings', transactionEntityManager);
    await deleteAll('poker_game_seat_info', transactionEntityManager);
    await deleteAll('high_hand', transactionEntityManager);
    await deleteAll('game_reward', transactionEntityManager);
    await deleteAll('game_reward_tracking', transactionEntityManager);
    await deleteAll('poker_game', transactionEntityManager);
  });
  await getHistoryManager().transaction(async transactionEntityManager => {
    await deleteAll('hand_history', transactionEntityManager);
    await deleteAll('players_in_game', transactionEntityManager);
    await deleteAll('game_history', transactionEntityManager);
    await deleteAll('high_hand_history', transactionEntityManager);
    await deleteAll('club_stats', transactionEntityManager);
    await deleteAll('player_game_stats', transactionEntityManager);
  });
  await Cache.reset();
  return true;
}

export async function resetDB() {
  try {
    await getHistoryManager().transaction(async transactionEntityManager => {
      await deleteAll('club_stats', transactionEntityManager);
      await deleteAll('game_history', transactionEntityManager);
      await deleteAll('players_in_game', transactionEntityManager);
      await deleteAll('high_hand_history', transactionEntityManager);
      await deleteAll('player_game_stats', transactionEntityManager);
      await deleteAll('player_hand_stats', transactionEntityManager);
      await deleteAll('hand_history', transactionEntityManager);
    });
    await getUserManager().transaction(async transactionEntityManager => {
      await deleteAll('player_notes', transactionEntityManager);
      await deleteAll('club_messages', transactionEntityManager);
      await deleteAll('saved_hands', transactionEntityManager);
      await deleteAll('announcement', transactionEntityManager);
      //await deleteAll('club_token_transactions', transactionEntityManager);
      await deleteAll('club_host_messages', transactionEntityManager);
      await deleteAll('reward', transactionEntityManager);
      await deleteAll('ClubMember', transactionEntityManager);
      await deleteAll('Club', transactionEntityManager);
      await deleteAll('club_member_stat', transactionEntityManager);
      await deleteAll('coin_purchase_transactions', transactionEntityManager);
      await deleteAll('player_coins', transactionEntityManager);
      await deleteAll('coin_consume_transactions', transactionEntityManager);
      await deleteAll('promotion_consumed', transactionEntityManager);
      await deleteAll('promotion', transactionEntityManager);
      await deleteAll('Player', transactionEntityManager);
    });
    await getGameManager().transaction(async transactionEntityManager => {
      await deleteAll('host_seat_change_process', transactionEntityManager);
      await deleteAll('high_hand', transactionEntityManager);
      await deleteAll('game_reward', transactionEntityManager);
      await deleteAll('game_reward_tracking', transactionEntityManager);
      await deleteAll('next_hand_updates', transactionEntityManager);
      await deleteAll('player_game_tracker', transactionEntityManager);
      await deleteAll('poker_game_seat_info', transactionEntityManager);
      await deleteAll('poker_game_updates', transactionEntityManager);
      await deleteAll('poker_game', transactionEntityManager);
      if (!isGameServerEnabled()) {
        await deleteAll('game_server', transactionEntityManager);
      }
    });
    await Cache.reset();
  } catch (err) {
    logger.error(`Failed to reset database. ${err.toString()}`);
    throw new Error(`Failed to reset database. ${err.toString()}`);
  }
  await Cache.reset();
  return true;
}

async function deleteAll(table: string, transactionManager?: EntityManager) {
  let queryBuilder: SelectQueryBuilder<any>;
  if (transactionManager) {
    queryBuilder = transactionManager.createQueryBuilder();
  } else {
    queryBuilder = getConnection().createQueryBuilder();
  }
  await queryBuilder.delete().from(table).where('').execute();
}

export function getResolvers() {
  return resolvers;
}
