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
import {ClubMember} from '@src/entity/club';
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

export async function sendMessageToMember(
  playerId: string,
  clubCode: string,
  memberId: number,
  text: string
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
    throw new Error(`Member: ${memberId} is not a member in club ${club.name}`);
  }
  try {
    return HostMessageRepository.sendHostMessage(
      club,
      clubMember1,
      text,
      HostMessageType.FROM_HOST
    );
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to send host message');
  }
}

export async function sendMessageToHost(
  playerId: string,
  clubCode: string,
  text: string
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
  const clubMember = await Cache.getClubMember(player.uuid, club.clubCode);
  if (!clubMember) {
    logger.error(`Player: ${player.uuid} is not a member in club ${club.name}`);
    throw new Error(
      `Player: ${player.uuid} is not a member in club ${club.name}`
    );
  }
  try {
    return HostMessageRepository.sendHostMessage(
      club,
      clubMember,
      text,
      HostMessageType.TO_HOST
    );
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to send host message');
  }
}

export async function hostMessageSummary(playerId: string, clubCode: string) {
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
  const clubMember = await Cache.getClubMember(player.uuid, club.clubCode);
  if (!clubMember || !clubMember.isOwner) {
    logger.error(`Player: ${player.uuid} is not a host in club ${club.name}`);
    throw new Error(
      `Player: ${player.uuid} is not a host in club ${club.name}`
    );
  }

  try {
    return HostMessageRepository.hostMessageSummary(club);
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to get host message summary');
  }
}

export async function messagesFromHost(
  playerId: string,
  clubCode: string,
  first?: number,
  afterId?: number
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
  const clubMember = await Cache.getClubMember(player.uuid, club.clubCode);
  if (!clubMember) {
    logger.error(`Player: ${player.uuid} is not a member in club ${club.name}`);
    throw new Error(
      `Player: ${player.uuid} is not a member in club ${club.name}`
    );
  }

  try {
    return HostMessageRepository.hostMessages(club, clubMember, first, afterId);
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to get messages from host');
  }
}

export async function messagesFromMember(
  playerId: string,
  clubCode: string,
  memberId: number,
  first?: number,
  afterId?: number
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
    throw new Error(`Member: ${memberId} is not a member in club ${club.name}`);
  }

  try {
    return HostMessageRepository.hostMessages(
      club,
      clubMember1,
      first,
      afterId
    );
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to get messages from member');
  }
}

export async function markHostMsgRead(playerId: string, clubCode: string) {
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
  const clubMember = await Cache.getClubMember(player.uuid, club.clubCode);
  if (!clubMember) {
    logger.error(`Player: ${player.uuid} is not a member in club ${club.name}`);
    throw new Error(
      `Player: ${player.uuid} is not a member in club ${club.name}`
    );
  }

  try {
    return HostMessageRepository.markAsRead(
      club,
      clubMember,
      HostMessageType.FROM_HOST
    );
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to mark as read for FROM_HOST messages');
  }
}

export async function markMemberMsgRead(
  playerId: string,
  clubCode: string,
  memberId: number
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
    throw new Error(`Member: ${memberId} is not a member in club ${club.name}`);
  }

  try {
    return HostMessageRepository.markAsRead(
      club,
      clubMember1,
      HostMessageType.TO_HOST
    );
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to mark as read for TO_HOST messages');
  }
}

const resolvers: any = {
  Query: {
    clubMessages: async (parent, args, ctx, info) => {
      return getClubMsg(ctx.req.playerId, args.clubCode, args.pageOptions);
    },
    hostMessageSummary: async (parent, args, ctx, info) => {
      return hostMessageSummary(ctx.req.playerId, args.clubCode);
    },
    messagesFromHost: async (parent, args, ctx, info) => {
      return messagesFromHost(
        ctx.req.playerId,
        args.clubCode,
        args.first,
        args.afterId
      );
    },
    messagesFromMember: async (parent, args, ctx, info) => {
      return messagesFromMember(
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
    sendMessageToMember: async (parent, args, ctx, info) => {
      return sendMessageToMember(
        ctx.req.playerId,
        args.clubCode,
        args.memberID,
        args.text
      );
    },
    sendMessageToHost: async (parent, args, ctx, info) => {
      return sendMessageToHost(ctx.req.playerId, args.clubCode, args.text);
    },
    markHostMsgRead: async (parent, args, ctx, info) => {
      return markHostMsgRead(ctx.req.playerId, args.clubCode);
    },
    markMemberMsgRead: async (parent, args, ctx, info) => {
      return markMemberMsgRead(ctx.req.playerId, args.clubCode, args.memberID);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
