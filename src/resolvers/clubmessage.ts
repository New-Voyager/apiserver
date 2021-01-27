import * as _ from 'lodash';
import {ClubMessageRepository} from '@src/repositories/clubmessage';
import {HostMessageRepository} from '@src/repositories/hostmessage';
import {ClubRepository} from '@src/repositories/club';
import {
  ClubMemberStatus,
  ClubMessageType,
  HostMessageType,
} from '@src/entity/types';
import {PageOptions} from '@src/types';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache';
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

export async function sendHostMessage(
  playerId: string,
  clubCode: string,
  memberId: number,
  text: any,
  messageType: HostMessageType
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const player = await Cache.getPlayer(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }
  const club = await Cache.getClub(clubCode);
  if (!club) {
    throw new Error(`Club ${clubCode} is not found`);
  }

  if (messageType === HostMessageType.FROM_HOST) {
    const clubMember = await Cache.getClubMember(player.uuid, club.clubCode);
    if (!clubMember || !clubMember.isOwner) {
      logger.error(`Player: ${player.uuid} is not a host in club ${club.name}`);
      throw new Error(
        `Player: ${player.uuid} is not a host in club ${club.name}`
      );
    }

    const clubMember1 = await ClubRepository.getClubMemberById(club, memberId);
    if (!clubMember1) {
      logger.error(`Member: ${memberId} is not a member in club ${club.name}`);
      throw new Error(
        `Member: ${memberId} is not a member in club ${club.name}`
      );
    }
  } else if (messageType === HostMessageType.TO_HOST) {
    const clubMember = await Cache.getClubMember(player.uuid, club.clubCode);
    if (!clubMember) {
      logger.error(
        `Player: ${player.uuid} is not a member in club ${club.name}`
      );
      throw new Error(
        `Player: ${player.uuid} is not a member in club ${club.name}`
      );
    }
    if (clubMember.id !== memberId) {
      logger.error(
        `Player: ${player.uuid} is not a member in club ${club.name} with memberId: ${memberId}`
      );
      throw new Error(
        `Player: ${player.uuid} is not a member in club ${club.name} with memberId: ${memberId}`
      );
    }
  } else {
    logger.error(
      `Not a valid message Type. messageType: ${HostMessageType[messageType]}`
    );
    throw new Error(
      `Not a valid message Type. messageType: ${HostMessageType[messageType]}`
    );
  }

  try {
    return HostMessageRepository.sendHostMessage(
      club.clubCode,
      memberId,
      text,
      messageType
    );
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to send host message');
  }
}

export async function hostMessageSummary(playerId: string, clubCode: string) {}

export async function hostMessages(
  playerId: string,
  clubCode: string,
  memberId: number,
  first: number,
  afterId: number
) {}

const resolvers: any = {
  Query: {
    clubMessages: async (parent, args, ctx, info) => {
      return getClubMsg(ctx.req.playerId, args.clubCode, args.pageOptions);
    },
    hostMessageSummary: async (parent, args, ctx, info) => {
      return hostMessageSummary(ctx.req.playerId, args.clubCode);
    },
    hostMessages: async (parent, args, ctx, info) => {
      return hostMessages(
        ctx.req.playerId,
        args.clubCode,
        args.memberID,
        args.first,
        args.afterId
      );
    },
  },

  Mutation: {
    sendClubMessage: async (parent, args, ctx, info) => {
      return sendClubMsg(ctx.req.playerId, args.clubCode, args.message);
    },
    sendHostMessage: async (parent, args, ctx, info) => {
      return sendHostMessage(
        ctx.req.playerId,
        args.clubCode,
        args.memberID,
        args.text,
        args.messageType
      );
    },
  },
};

export function getResolvers() {
  return resolvers;
}
