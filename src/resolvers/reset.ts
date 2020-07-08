import {getConnection} from 'typeorm';
import {getManager} from 'typeorm';

const resolvers: any = {
  Mutation: {
    resetDB: async (parent, args, ctx, info) => {
      //if (ctx.req.playerId !== 'TEST_USER') {
      //  throw new Error('Unauthorized');
      //}
      // delete all the entries
      await getManager().transaction(async transactionalEntityManager => {
        await deleteAll('PokerGamePlayers');
        await deleteAll('PlayerGame');
        await deleteAll('PokerHand');
        await deleteAll('PokerGame');
        await deleteAll('ClubMember');
        await deleteAll('Club');
        await deleteAll('Player');
        await deleteAll('GameServer');
        await deleteAll('hand_winners');
        await deleteAll('hand_history');
      });
      console.log('Database reset is complete');

      return true;
    },
  },
};

async function deleteAll(table: string) {
  await getConnection()
    .createQueryBuilder()
    .delete()
    .from(table)
    .where('id is not null')
    .execute();
}

export function getResolvers() {
  return resolvers;
}
