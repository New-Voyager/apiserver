import {sendRecoveryCode} from '@src/email';
import {Firebase} from '@src/firebase';
import {Nats} from '@src/nats';
import {PlayerRepository} from '@src/repositories/player';
import {getLogger} from '@src/utils/log';
import {v4 as uuidv4} from 'uuid';
import {loggers} from 'winston';
const logger = getLogger('resolvers::hello');
async function sendTestMessage(playerId: string) {
  const player = await PlayerRepository.getPlayerById(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }

  Firebase.sendMessage(player.firebaseToken, {message: 'test'}).catch(e => {
    logger.error(`Sending firebase message failed. Error: ${e.message}`);
  });
}

async function sendTestEmail(playerId: string) {
  // const player = await PlayerRepository.getPlayerById(playerId);
  // if (!player) {
  //   throw new Error(`Player ${playerId} is not found`);
  // }
  //Firebase.sendEmail('soma.voyager@gmail.com', 'RECOVERY_CODE', {code: '123456'});

  sendRecoveryCode('soma.voyager@gmail.com', undefined, '123456').catch(e => {
    logger.error(`Sending recovery code email failed. Error: ${e.message}`);
  });
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
      return 'World';
    },
  },
  Mutation: {
    sendTestEmail: async (parent, args, ctx, info) => {
      sendTestEmail(ctx.req.playerId).catch(e => {
        logger.error(`Sending test email failed. Error: ${e.message}`);
      });
    },
    sendTestNotification: async (parent, args, ctx, info) => {
      sendTestNotification(ctx.req.playerId).catch(e => {
        logger.error(`Sending firebase message failed. Error: ${e.message}`);
      });
    },
    sendTestMessage: async (parent, args, ctx, info) => {
      sendTestMessage(ctx.req.playerId).catch(e => {
        logger.error(`Sending firebase message failed. Error: ${e.message}`);
      });
      return true;
    },
  },
};

export function getResolvers() {
  return resolvers;
}
