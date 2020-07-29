import * as _ from 'lodash';
import {ClubFreqMessageRepository} from '@src/repositories/clubfreqmessage';
import {getLogger} from '@src/utils/log';
const logger = getLogger('clubfreqmessage');

export async function getClubFavMsg(playerId: string, clubCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const messages = await ClubFreqMessageRepository.clubFavoriteMessage(
    clubCode
  );
  return _.map(messages, x => {
    return {
      id: x.id,
      clubCode: x.clubCode,
      playerId: x.playerId,
      text: x.text,
      audioLink: x.audioLink,
      imageLink: x.imageLink,
    };
  });
}

export async function getPlayerFavMsg(playerId: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const messages = await ClubFreqMessageRepository.playerFavoriteMessage(
    playerId
  );
  return _.map(messages, x => {
    return {
      id: x.id,
      clubCode: x.clubCode,
      playerId: x.playerId,
      text: x.text,
      audioLink: x.audioLink,
      imageLink: x.imageLink,
    };
  });
}

export async function saveFavMsg(playerId: string, message: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (!message) {
    errors.push('Message Object not found');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  try {
    return ClubFreqMessageRepository.saveFreqMessage(message);
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to send the message');
  }
}

const resolvers: any = {
  Query: {
    clubFavoriteMessages: async (parent, args, ctx, info) => {
      return getClubFavMsg(ctx.req.playerId, args.clubCode);
    },

    playerFavoriteMessages: async (parent, args, ctx, info) => {
      return getPlayerFavMsg(ctx.req.playerId);
    },
  },

  Mutation: {
    saveFreqMessage: async (parent, args, ctx, info) => {
      return saveFavMsg(ctx.req.playerId, args.message);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
