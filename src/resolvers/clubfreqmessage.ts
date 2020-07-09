import * as _ from 'lodash';
import {ClubFreqMessageRepository} from '@src/repositories/clubfreqmessage';
import {ClubRepository} from '@src/repositories/club';
import {ClubMemberStatus} from '@src/entity/club';
import {ClubMessageType} from '@src/entity/clubmessage';

const resolvers: any = {
  Query: {
    getFreqMessages: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      const clubMembers1 = await ClubRepository.getMembers(args.clubId);
      const clubMember = await ClubRepository.isClubMember(
        args.clubId,
        ctx.req.playerId
      );
      if (!clubMember) {
        console.log(
          `The user ${ctx.req.playerId} is not a member of ${
            args.clubId
          }, ${JSON.stringify(clubMembers1)}`
        );
        throw new Error('Unauthorized');
      }

      if (clubMember.status === ClubMemberStatus.KICKEDOUT) {
        console.log(
          `The user ${ctx.req.playerId} is kicked out of ${args.clubId}`
        );
        throw new Error('Unauthorized');
      }
      const messages = await ClubFreqMessageRepository.getClubFreqMessage(
        args.clubId,
        args.playerId
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
      if (!args.message.clubId) {
        errors.push('ClubId not found');
      }
      if (!args.message) {
        errors.push('Message Object not found');
      }
      if (args.message.playerId === '') {
        errors.push('Player Tags is a required field');
      }
      if (errors.length > 0) {
        throw new Error(errors.join('\n'));
      }

      try {
        return ClubFreqMessageRepository.sendClubMessage(args.message);
      } catch (err) {
        console.log(err);
        throw new Error('Failed to send the message');
      }
    },
  },
};

export function getResolvers() {
  return resolvers;
}
