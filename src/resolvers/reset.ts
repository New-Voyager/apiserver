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
      await getManager().transaction(async transactionalEntityManager => {
        await deleteAll('ClubGameRake');
        await deleteAll('PlayerGameTracker');
        await deleteAll('PokerGamePlayers');
        await deleteAll('PlayerGame');
        await deleteAll('PokerHand');
        await deleteAll('ClubGameRake');
        await deleteAll('PokerGame');
        await deleteAll('ClubMember');
        await deleteAll('Club');
        await deleteAll('player_game_tracker');
        await deleteAll('club_game_rake');
        await deleteAll('Player');
        await deleteAll('game_gameserver');
        await deleteAll('GameServer');
        await deleteAll('starred_hands');
        await deleteAll('hand_winners');
        await deleteAll('hand_history');
      });
      logger.info('Database reset is complete');

      return true;
    },
  },
};

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
