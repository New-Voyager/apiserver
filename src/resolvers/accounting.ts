import {Cache} from '@src/cache';
import {getLogger} from '@src/utils/log';
import {TransactionSubType} from '@src/entity/types';
const logger = getLogger('accounting');

export async function clubTransactions(
  hostId: string,
  clubCode: string
): Promise<Array<any>> {
  const host = await Cache.getPlayer(hostId);
  if (!host) {
    throw new Error(`Player ${hostId} is not found`);
  }
  const club = await Cache.getClub(clubCode);
  if (!club) {
    throw new Error(`Club ${clubCode} is not found`);
  }

  const clubOwner = await Cache.getClubMember(host.uuid, club.clubCode);
  if (!clubOwner || !clubOwner.isOwner) {
    logger.error(`Player: ${host.uuid} is not a host in club ${club.name}`);
    throw new Error(`Player: ${host.uuid} is not a host in club ${club.name}`);
  }

  // TODO call repository functions
  return [];
}

export async function addTokensToPlayer(
  hostId: string,
  clubCode: string,
  playerId: string,
  subType: TransactionSubType,
  amount: number,
  notes: string
): Promise<boolean> {
  const host = await Cache.getPlayer(hostId);
  if (!host) {
    throw new Error(`Player ${hostId} is not found`);
  }
  const player = await Cache.getPlayer(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }
  const club = await Cache.getClub(clubCode);
  if (!club) {
    throw new Error(`Club ${clubCode} is not found`);
  }

  const clubOwner = await Cache.getClubMember(host.uuid, club.clubCode);
  if (!clubOwner || !clubOwner.isOwner) {
    logger.error(`Player: ${host.uuid} is not a host in club ${club.name}`);
    throw new Error(`Player: ${host.uuid} is not a host in club ${club.name}`);
  }
  const clubMember = await Cache.getClubMember(player.uuid, club.clubCode);
  if (!clubMember) {
    logger.error(`Player: ${player.uuid} is not a member in club ${club.name}`);
    throw new Error(
      `Player: ${player.uuid} is not a member in club ${club.name}`
    );
  }

  // TODO call repository functions
  return true;
}

export async function withdrawTokensFromPlayer(
  hostId: string,
  clubCode: string,
  playerId: string,
  subType: TransactionSubType,
  amount: number,
  notes: string
): Promise<boolean> {
  const host = await Cache.getPlayer(hostId);
  if (!host) {
    throw new Error(`Player ${hostId} is not found`);
  }
  const player = await Cache.getPlayer(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }
  const club = await Cache.getClub(clubCode);
  if (!club) {
    throw new Error(`Club ${clubCode} is not found`);
  }

  const clubOwner = await Cache.getClubMember(host.uuid, club.clubCode);
  if (!clubOwner || !clubOwner.isOwner) {
    logger.error(`Player: ${host.uuid} is not a host in club ${club.name}`);
    throw new Error(`Player: ${host.uuid} is not a host in club ${club.name}`);
  }
  const clubMember = await Cache.getClubMember(player.uuid, club.clubCode);
  if (!clubMember) {
    logger.error(`Player: ${player.uuid} is not a member in club ${club.name}`);
    throw new Error(
      `Player: ${player.uuid} is not a member in club ${club.name}`
    );
  }

  // TODO call repository functions
  return true;
}

export async function addTokensToClub(
  hostId: string,
  clubCode: string,
  subType: TransactionSubType,
  amount: number,
  notes: string
): Promise<boolean> {
  const host = await Cache.getPlayer(hostId);
  if (!host) {
    throw new Error(`Player ${hostId} is not found`);
  }
  const club = await Cache.getClub(clubCode);
  if (!club) {
    throw new Error(`Club ${clubCode} is not found`);
  }

  const clubOwner = await Cache.getClubMember(host.uuid, club.clubCode);
  if (!clubOwner || !clubOwner.isOwner) {
    logger.error(`Player: ${host.uuid} is not a host in club ${club.name}`);
    throw new Error(`Player: ${host.uuid} is not a host in club ${club.name}`);
  }

  // TODO call repository functions
  return true;
}

export async function withdrawTokensFromClub(
  hostId: string,
  clubCode: string,
  subType: TransactionSubType,
  amount: number,
  notes: string
): Promise<boolean> {
  const host = await Cache.getPlayer(hostId);
  if (!host) {
    throw new Error(`Player ${hostId} is not found`);
  }
  const club = await Cache.getClub(clubCode);
  if (!club) {
    throw new Error(`Club ${clubCode} is not found`);
  }

  const clubOwner = await Cache.getClubMember(host.uuid, club.clubCode);
  if (!clubOwner || !clubOwner.isOwner) {
    logger.error(`Player: ${host.uuid} is not a host in club ${club.name}`);
    throw new Error(`Player: ${host.uuid} is not a host in club ${club.name}`);
  }

  // TODO call repository functions
  return true;
}

export async function updateClubBalance(
  hostId: string,
  clubCode: string,
  amount: number,
  notes: string
): Promise<boolean> {
  const host = await Cache.getPlayer(hostId);
  if (!host) {
    throw new Error(`Player ${hostId} is not found`);
  }
  const club = await Cache.getClub(clubCode);
  if (!club) {
    throw new Error(`Club ${clubCode} is not found`);
  }

  const clubOwner = await Cache.getClubMember(host.uuid, club.clubCode);
  if (!clubOwner || !clubOwner.isOwner) {
    logger.error(`Player: ${host.uuid} is not a host in club ${club.name}`);
    throw new Error(`Player: ${host.uuid} is not a host in club ${club.name}`);
  }

  // TODO call repository functions
  return true;
}

export async function updatePlayerBalance(
  hostId: string,
  clubCode: string,
  playerId: string,
  amount: number,
  notes: string
): Promise<boolean> {
  const host = await Cache.getPlayer(hostId);
  if (!host) {
    throw new Error(`Player ${hostId} is not found`);
  }
  const player = await Cache.getPlayer(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }
  const club = await Cache.getClub(clubCode);
  if (!club) {
    throw new Error(`Club ${clubCode} is not found`);
  }

  const clubOwner = await Cache.getClubMember(host.uuid, club.clubCode);
  if (!clubOwner || !clubOwner.isOwner) {
    logger.error(`Player: ${host.uuid} is not a host in club ${club.name}`);
    throw new Error(`Player: ${host.uuid} is not a host in club ${club.name}`);
  }
  const clubMember = await Cache.getClubMember(player.uuid, club.clubCode);
  if (!clubMember) {
    logger.error(`Player: ${player.uuid} is not a member in club ${club.name}`);
    throw new Error(
      `Player: ${player.uuid} is not a member in club ${club.name}`
    );
  }

  // TODO call repository functions
  return true;
}

const resolvers: any = {
  Query: {
    clubTransactions: async (parent, args, ctx, info) => {
      return clubTransactions(ctx.req.playerId, args.clubCode);
    },
  },
  Mutation: {
    addTokensToPlayer: async (parent, args, ctx, info) => {
      return addTokensToPlayer(
        ctx.req.playerId,
        args.clubCode,
        args.playerId,
        args.subType,
        args.amount,
        args.notes
      );
    },
    withdrawTokensFromPlayer: async (parent, args, ctx, info) => {
      return withdrawTokensFromPlayer(
        ctx.req.playerId,
        args.clubCode,
        args.playerId,
        args.subType,
        args.amount,
        args.notes
      );
    },
    addTokensToClub: async (parent, args, ctx, info) => {
      return addTokensToClub(
        ctx.req.playerId,
        args.clubCode,
        args.subType,
        args.amount,
        args.notes
      );
    },
    withdrawTokensFromClub: async (parent, args, ctx, info) => {
      return withdrawTokensFromClub(
        ctx.req.playerId,
        args.clubCode,
        args.subType,
        args.amount,
        args.notes
      );
    },
    updateClubBalance: async (parent, args, ctx, info) => {
      return updateClubBalance(
        ctx.req.playerId,
        args.clubCode,
        args.amount,
        args.notes
      );
    },
    updatePlayerBalance: async (parent, args, ctx, info) => {
      return updatePlayerBalance(
        ctx.req.playerId,
        args.clubCode,
        args.playerId,
        args.amount,
        args.notes
      );
    },
  },
};

export function getResolvers() {
  return resolvers;
}
