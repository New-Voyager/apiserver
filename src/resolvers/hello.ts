import {Firebase} from '@src/firebase';
import {PlayerRepository} from '@src/repositories/player';

async function sendTestMessage(playerId: string) {
  const player = await PlayerRepository.getPlayerById(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }

  Firebase.sendMessage(player.firebaseToken, {message: 'test'});
}

const resolvers: any = {
  Query: {
    hello: async (parent, args, ctx, info) => {
      return 'World';
    },
  },
  Mutation: {
    sendTestMessage: async (parent, args, ctx, info) => {
      sendTestMessage(ctx.req.playerId);
      return true;
    },
  },
};

export function getResolvers() {
  return resolvers;
}
