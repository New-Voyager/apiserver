import * as _ from 'lodash';
import {ClubFreqMessageRepository} from '@src/repositories/clubfreqmessage';
import {ClubRepository} from '@src/repositories/club';
import {ClubMemberStatus} from '@src/entity/club';
import {ClubMessageType} from '@src/entity/clubmessage';
import {FavouriteMessageInputFormat} from '@src/repositories/clubfreqmessage';
import {getLogger} from '@src/utils/log';
const logger = getLogger('clubfreqmessage');

export async function getClubFavMsg(playerId: string, clubId: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const messages = await ClubFreqMessageRepository.clubFavoriteMessage(clubId);
  logger.debug(messages);
  return _.map(messages, x => {
    return {
      id: x.id,
      clubId: x.clubId,
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
      clubId: x.clubId,
      playerId: x.playerId,
      text: x.text,
      audioLink: x.audioLink,
      imageLink: x.imageLink,
    };
  });
}

export async function saveFavMsg(
  playerId: string,
  message: FavouriteMessageInputFormat
) {
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
      return getClubFavMsg(ctx.req.playerId, args.clubId);
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
