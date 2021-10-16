import {Cache} from '@src/cache';
import {AnnouncementLevel} from '@src/entity/types';
import {AnnouncementsRepository} from '@src/repositories/announcements';
import {AnnouncementData} from '@src/types';
import {errToLogString, getLogger} from '@src/utils/log';
const logger = getLogger('resolvers::announcements');

export async function clubAnnouncements(
  playerId: string,
  clubCode: string
): Promise<Array<AnnouncementData>> {
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
    const resp = await AnnouncementsRepository.clubAnnouncements(club);
    return resp;
  } catch (error) {
    logger.error(`Failed with error: ${errToLogString(error)}`);
    throw new Error(`Failed with error: ${JSON.stringify(error)}`);
  }
}

export async function systemAnnouncements(
  playerId: string
): Promise<Array<AnnouncementData>> {
  try {
    const resp = await AnnouncementsRepository.systemAnnouncements();
    return resp;
  } catch (error) {
    logger.error(`Failed with error: ${errToLogString(error)}`);
    throw new Error(`Failed with error: ${JSON.stringify(error)}`);
  }
}

export async function addClubAnnouncement(
  playerId: string,
  clubCode: string,
  text: string,
  expiresAt: string
): Promise<boolean> {
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
    await AnnouncementsRepository.addClubAnnouncement(club, text, expiresAt);
    return true;
  } catch (error) {
    logger.error(`Failed with error: ${errToLogString(error)}`);
    throw new Error(`Failed with error: ${JSON.stringify(error)}`);
  }
}

export async function addSystemAnnouncement(
  playerId: string,
  text: string,
  expiresAt: string
): Promise<boolean> {
  // const player = await Cache.getPlayer(playerId);
  // if (!player) {
  //   throw new Error(`Player ${playerId} is not found`);
  // }

  try {
    await AnnouncementsRepository.addSystemAnnouncement(
      text,
      AnnouncementLevel.INFO,
      expiresAt
    );
    return true;
  } catch (error) {
    logger.error(`Failed with error: ${errToLogString(error)}`);
    throw new Error(`Failed with error: ${JSON.stringify(error)}`);
  }
}

const resolvers: any = {
  Query: {
    clubAnnouncements: async (parent, args, ctx, info) => {
      return clubAnnouncements(ctx.req.playerId, args.clubCode);
    },
    systemAnnouncements: async (parent, args, ctx, info) => {
      return systemAnnouncements(ctx.req.playerId);
    },
  },
  Mutation: {
    addClubAnnouncement: async (parent, args, ctx, info) => {
      return addClubAnnouncement(
        ctx.req.playerId,
        args.clubCode,
        args.text,
        args.expiresAt
      );
    },
    addSystemAnnouncement: async (parent, args, ctx, info) => {
      return addSystemAnnouncement(ctx.req.playerId, args.text, args.expiresAt);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
