import {getConnection} from 'typeorm';
import {getManager} from 'typeorm';
import {getLogger} from '@src/utils/log';
import {isGameServerEnabled, startTimer} from '@src/gameserver';
const logger = getLogger('reset');

const resolvers: any = {
  Mutation: {
    resetDB: async (parent, args, ctx, info) => {
      //if (ctx.req.playerId !== 'TEST_USER') {
      //  throw new Error('Unauthorized');
      //}
      // delete all the entries
      const resp = await resetDB();
      logger.info('Database reset is complete');
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

export async function resetDB() {
  await getManager().transaction(async transactionalEntityManager => {
    await deleteAll('next_hand_updates');
    await deleteAll('promotion_winners');
    await deleteAll('game_promotion');
    await deleteAll('promotion');
    await deleteAll('player_game_tracker');
    await deleteAll('club_chips_transaction');
    await deleteAll('club_game_rake');
    await deleteAll('PokerGamePlayers');
    await deleteAll('PokerHand');
    await deleteAll('ClubGameRake');
    await deleteAll('game_gameserver');
    await deleteAll('poker_game_updates');
    await deleteAll('PokerGame');
    await deleteAll('ClubMember');
    await deleteAll('Club');
    await deleteAll('Player');
    if (!isGameServerEnabled()) {
      await deleteAll('game_server');
    }
    await deleteAll('starred_hands');
    await deleteAll('hand_winners');
    await deleteAll('hand_history');
  });
  return true;
}

async function deleteAll(table: string) {
  await getConnection()
    .createQueryBuilder()
    .delete()
    .from(table)
    .where('')
    .execute();
}

export function getResolvers() {
  return resolvers;
}
