import * as _ from 'lodash';
import {ClubMessageRepository} from '@src/repositories/clubmessage';
import {ClubRepository} from '@src/repositories/club';
import {ClubMemberStatus} from '@src/entity/club';
import {ClubMessageType} from '@src/entity/clubmessage';
import {PageOptions} from '@src/types';
import {getLogger} from '@src/utils/log';
const logger = getLogger('clubmessage');

export async function getClubMsg(
  playerId: string,
  clubId: string,
  pageOptions?: PageOptions
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const clubMembers1 = await ClubRepository.getMembers(clubId);
  const clubMember = await ClubRepository.isClubMember(clubId, playerId);
  if (!clubMember) {
    logger.error(
      `The user ${playerId} is not a member of ${clubId}, ${JSON.stringify(
        clubMembers1
      )}`
    );
    throw new Error('Unauthorized');
  }

  if (clubMember.status === ClubMemberStatus.KICKEDOUT) {
    logger.error(`The user ${playerId} is kicked out of ${clubId}`);
    throw new Error('Unauthorized');
  }
  const messages = await ClubMessageRepository.getClubMessage(
    clubId,
    pageOptions
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
}

export async function sendClubMsg(
  playerId: string,
  clubId: string,
  message: any
) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (!clubId) {
    errors.push('ClubId not found');
  }
  if (!message) {
    errors.push('Message Object not found');
  }
  if (message.messageType === '') {
    errors.push('Message Type is a required field');
  }
  if (message.playerTags === '') {
    errors.push('Player Tags is a required field');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  try {
    return ClubMessageRepository.sendClubMessage(clubId, message);
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to send the message');
  }
}

const resolvers: any = {
  Query: {
    clubMessages: async (parent, args, ctx, info) => {
      return getClubMsg(ctx.req.playerId, args.clubId, args.pageOptions);
    },
  },

  Mutation: {
    sendClubMessage: async (parent, args, ctx, info) => {
      return sendClubMsg(ctx.req.playerId, args.clubId, args.message);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
