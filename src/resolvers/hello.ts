import {sendRecoveryCode} from '@src/email';
import {Firebase} from '@src/firebase';
import {Nats} from '@src/nats';
import {PlayerRepository} from '@src/repositories/player';
import {v4 as uuidv4} from 'uuid';
import {loggers} from 'winston';

async function sendTestMessage(playerId: string) {
  const player = await PlayerRepository.getPlayerById(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }

  Firebase.sendMessage(player.firebaseToken, {message: 'test'});
}

async function sendTestEmail(playerId: string) {
  // const player = await PlayerRepository.getPlayerById(playerId);
  // if (!player) {
  //   throw new Error(`Player ${playerId} is not found`);
  // }
  //Firebase.sendEmail('soma.voyager@gmail.com', 'RECOVERY_CODE', {code: '123456'});

  sendRecoveryCode('soma.voyager@gmail.com', undefined, '123456');
}

async function sendTestNotification(playerId: string) {
  const player = await PlayerRepository.getPlayerById(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }
  const messageId = uuidv4();
  let message = {
    type: 'TEST_PUSH',
    playerId: playerId,
    name: player.name,
    requestId: messageId,
  };
  Firebase.sendMessage(player.firebaseToken, message).catch(err => {
    // ignore the error
  });
  Nats.sendTestMessage(player, message);
}

const resolvers: any = {
  Query: {
    hello: async (parent, args, ctx, info) => {
      //await Firebase.getAvailableProducts();
      console.log('hello resolver is called');
      return 'World';
    },
  },
  Mutation: {
    sendTestEmail: async (parent, args, ctx, info) => {
      sendTestEmail(ctx.req.playerId);
    },
    sendTestNotification: async (parent, args, ctx, info) => {
      sendTestNotification(ctx.req.playerId);
    },
    sendTestMessage: async (parent, args, ctx, info) => {
      sendTestMessage(ctx.req.playerId);
      // //const [sessionId, pluginId] = await getAudioSession(100, '1234');
      // //await closeAudioSession(10, sessionId, pluginId);

      // const session = await JanusSession.create('janusrocks');
      // await session.attachAudio();
      // await session.createRoom(100, 'abcd');

      // const session1 = await JanusSession.joinSession(session.getId());
      // session1.attachAudioWithId(session.getHandleId());
      // await session.leaveRoom(100);
      return true;
    },
  },
};

export function getResolvers() {
  return resolvers;
}
