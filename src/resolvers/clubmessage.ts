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
  clubCode: string,
  pageOptions?: PageOptions
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const clubMembers1 = await ClubRepository.getMembers(clubCode);
  const clubMember = await ClubRepository.isClubMember(clubCode, playerId);
  if (!clubMember) {
    logger.error(
      `The user ${playerId} is not a member of ${clubCode}, ${JSON.stringify(
        clubMembers1
      )}`
    );
    throw new Error('Unauthorized');
  }

  if (clubMember.status === ClubMemberStatus.KICKEDOUT) {
    logger.error(`The user ${playerId} is kicked out of ${clubCode}`);
    throw new Error('Unauthorized');
  }
  const messages = await ClubMessageRepository.getClubMessage(
    clubCode,
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
      clubCode: x.clubCode,
      text: x.text,
      messageTime: x.updatedAt,
      messageTimeInEpoc: Math.floor(x.updatedAt.getTime() / 1000),
    };
  });
}

export async function sendClubMsg(
  playerId: string,
  clubCode: string,
  message: any
) {
  const errors = new Array<string>();
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  if (!clubCode) {
    errors.push('ClubCode not found');
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
    return ClubMessageRepository.sendClubMessage(clubCode, message);
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to send the message');
  }
}

const resolvers: any = {
  Query: {
    clubMessages: async (parent, args, ctx, info) => {
      return getClubMsg(ctx.req.playerId, args.clubCode, args.pageOptions);
    },
  },

  Mutation: {
    sendClubMessage: async (parent, args, ctx, info) => {
      return sendClubMsg(ctx.req.playerId, args.clubCode, args.message);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
