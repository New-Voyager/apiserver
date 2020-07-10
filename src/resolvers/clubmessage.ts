import * as _ from 'lodash';
import {ClubMessageRepository} from '@src/repositories/clubmessage';
import {ClubRepository} from '@src/repositories/club';
import {ClubMemberStatus} from '@src/entity/club';
import {ClubMessageType} from '@src/entity/clubmessage';
import {getLogger} from '@src/utils/log';
const logger = getLogger("clubmessage");

const resolvers: any = {
  Query: {
    clubMessages: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      const clubMembers1 = await ClubRepository.getMembers(args.clubId);
      const clubMember = await ClubRepository.isClubMember(
        args.clubId,
        ctx.req.playerId
      );
      if (!clubMember) {
        logger.error(
          `The user ${ctx.req.playerId} is not a member of ${
            args.clubId
          }, ${JSON.stringify(clubMembers1)}`
        );
        throw new Error('Unauthorized');
      }

      if (clubMember.status === ClubMemberStatus.KICKEDOUT) {
        logger.error(
          `The user ${ctx.req.playerId} is kicked out of ${args.clubId}`
        );
        throw new Error('Unauthorized');
      }
      const messages = await ClubMessageRepository.getClubMessage(
        args.clubId,
        args.pageOptions
      );
      return _.map(messages, x => {
        return {
          id: x.id,
          messageType: ClubMessageType[x.messageType],
          handNum: x.handNum,
          giphyLink: x.giphyLink,
          gameNum: x.gameNum,
          playerTags: x.playerTags,
          clubId: x.clubId,
          text: x.text,
        };
      });
    },
  },

  Mutation: {
    sendClubMessage: async (parent, args, ctx, info) => {
      const errors = new Array<string>();
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      if (!args.clubId) {
        errors.push('ClubId not found');
      }
      if (!args.message) {
        errors.push('Message Object not found');
      }
      if (args.message.messageType === '') {
        errors.push('Message Type is a required field');
      }
      if (args.message.playerTags === '') {
        errors.push('Player Tags is a required field');
      }
      if (errors.length > 0) {
        throw new Error(errors.join('\n'));
      }

      try {
        return ClubMessageRepository.sendClubMessage(args.clubId, args.message);
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
