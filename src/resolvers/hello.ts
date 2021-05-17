import {Firebase} from '@src/firebase';
import {closeAudioSession, getAudioSession, JanusSession} from '@src/janus';
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
      // sendTestMessage(ctx.req.playerId);
      //const [sessionId, pluginId] = await getAudioSession(100, '1234');
      //await closeAudioSession(10, sessionId, pluginId);

      const session = await JanusSession.create('janusrocks');
      await session.attachAudio();
      await session.createRoom(100, 'abcd');

      const session1 = await JanusSession.joinSession(session.getId());
      session1.attachAudioWithId(session.getHandleId());
      await session.leaveRoom(100);
      return true;
    },
  },
};

export function getResolvers() {
  return resolvers;
}
