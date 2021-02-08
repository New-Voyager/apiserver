import {Cache} from '@src/cache';
import {AnnouncementsRepository} from '@src/repositories/announcements';
import {getLogger} from '@src/utils/log';
const logger = getLogger('announcements');

export async function clubAnnouncements(
  playerId: string,
  clubCode: string
): Promise<Array<any>> {
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

  const resp = await AnnouncementsRepository.clubAnnouncements(club);
  return resp;
}

export async function systemAnnouncements(
  playerId: string
): Promise<Array<any>> {
  // const player = await Cache.getPlayer(playerId);
  // if (!player) {
  //   throw new Error(`Player ${playerId} is not found`);
  // }

  const resp = await AnnouncementsRepository.systemAnnouncements();
  return resp;
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

  await AnnouncementsRepository.addClubAnnouncement(club, text, expiresAt);
  return true;
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

  await AnnouncementsRepository.addSystemAnnouncement(text, expiresAt);
  return true;
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
