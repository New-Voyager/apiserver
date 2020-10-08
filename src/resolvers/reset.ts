import {getConnection} from 'typeorm';
import {getManager} from 'typeorm';
import {getLogger} from '@src/utils/log';
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
  },
};

export async function resetDB() {
  await getManager().transaction(async transactionalEntityManager => {
    await deleteAll('promotion_winners');
    await deleteAll('game_promotion');
    await deleteAll('promotion');
    await deleteAll('player_game_tracker');
    await deleteAll('club_chips_transaction');
    await deleteAll('club_game_rake');
    await deleteAll('club_balance');
    await deleteAll('club_player_balance');
    await deleteAll('PokerGamePlayers');
    //await deleteAll('PlayerGame');
    await deleteAll('PokerHand');
    await deleteAll('ClubGameRake');
    await deleteAll('PokerGame');
    await deleteAll('ClubMember');
    await deleteAll('Club');
    await deleteAll('Player');
    await deleteAll('game_gameserver');
    await deleteAll('game_server');
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
