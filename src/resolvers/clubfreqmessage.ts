import * as _ from 'lodash';
import {ClubFreqMessageRepository} from '@src/repositories/clubfreqmessage';
import {ClubRepository} from '@src/repositories/club';
import {ClubMemberStatus} from '@src/entity/club';
import {ClubMessageType} from '@src/entity/clubmessage';
import {getLogger} from '@src/utils/log';
const logger = getLogger('clubfreqmessage');

const resolvers: any = {
  Query: {
    clubFavoriteMessages: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      const messages = await ClubFreqMessageRepository.clubFavoriteMessage(
        args.clubId
      );
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
    },

    playerFavoriteMessages: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      const messages = await ClubFreqMessageRepository.playerFavoriteMessage(
        ctx.req.playerId
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
    },
  },

  Mutation: {
    saveFreqMessage: async (parent, args, ctx, info) => {
      const errors = new Array<string>();
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      if (!args.message) {
        errors.push('Message Object not found');
      }
      if (errors.length > 0) {
        throw new Error(errors.join('\n'));
      }

      try {
        return ClubFreqMessageRepository.saveFreqMessage(args.message);
      } catch (err) {
        logger.error(err);
        throw new Error('Failed to send the message');
      }
    },
  },
};

export function getResolvers() {
  return resolvers;
}
