import {Cache} from '@src/cache';
import {getLogger} from '@src/utils/log';
import {TransactionSubType} from '@src/entity/types';
import {AccountingRepository} from '@src/repositories/accounting';
import {ClubTransaction, PlayerTransaction} from '@src/types';
const logger = getLogger('accounting - resolvers');

export async function clubTransactions(
  hostId: string,
  clubCode: string
): Promise<Array<ClubTransaction>> {
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
  try {
    const resp = await AccountingRepository.clubTransactions(club);
    return resp;
  } catch (error) {
    logger.error(`Failed with error: ${JSON.stringify(error)}`);
    throw new Error(`Failed with error: ${JSON.stringify(error)}`);
  }
}

export async function addTokensToPlayer(
  hostId: string,
  clubCode: string,
  playerId: string,
  subType: string,
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

  try {
    const sub: TransactionSubType = TransactionSubType[
      subType
    ] as TransactionSubType;
    const resp = await AccountingRepository.addTokensToPlayer(
      host,
      club,
      clubMember,
      player,
      sub,
      amount,
      notes
    );
    return resp;
  } catch (error) {
    logger.error(`Failed with error: ${JSON.stringify(error)}`);
    throw new Error(`Failed with error: ${JSON.stringify(error)}`);
  }
}

export async function withdrawTokensFromPlayer(
  hostId: string,
  clubCode: string,
  playerId: string,
  subType: string,
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

  try {
    const sub: TransactionSubType = TransactionSubType[
      subType
    ] as TransactionSubType;
    const resp = await AccountingRepository.withdrawTokensFromPlayer(
      host,
      club,
      clubMember,
      player,
      sub,
      amount,
      notes
    );
    return resp;
  } catch (error) {
    logger.error(`Failed with error: ${JSON.stringify(error)}`);
    throw new Error(`Failed with error: ${JSON.stringify(error)}`);
  }
}

export async function addTokensToClub(
  hostId: string,
  clubCode: string,
  subType: string,
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

  try {
    const sub: TransactionSubType = TransactionSubType[
      subType
    ] as TransactionSubType;
    const resp = await AccountingRepository.addTokensToClub(
      host,
      club,
      sub,
      amount,
      notes
    );
    return resp;
  } catch (error) {
    logger.error(`Failed with error: ${JSON.stringify(error)}`);
    throw new Error(`Failed with error: ${JSON.stringify(error)}`);
  }
}

export async function withdrawTokensFromClub(
  hostId: string,
  clubCode: string,
  subType: string,
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

  try {
    const sub: TransactionSubType = TransactionSubType[
      subType
    ] as TransactionSubType;
    const resp = await AccountingRepository.withdrawTokensFromClub(
      host,
      club,
      sub,
      amount,
      notes
    );
    return resp;
  } catch (error) {
    logger.error(`Failed with error: ${JSON.stringify(error)}`);
    throw new Error(`Failed with error: ${JSON.stringify(error)}`);
  }
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

  try {
    const resp = await AccountingRepository.updateClubBalance(
      host,
      club,
      amount,
      notes
    );
    return resp;
  } catch (error) {
    logger.error(`Failed with error: ${JSON.stringify(error)}`);
    throw new Error(`Failed with error: ${JSON.stringify(error)}`);
  }
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

  try {
    const resp = await AccountingRepository.updatePlayerBalance(
      host,
      club,
      clubMember,
      player,
      amount,
      notes
    );
    return resp;
  } catch (error) {
    logger.error(`Failed with error: ${JSON.stringify(error)}`);
    throw new Error(`Failed with error: ${JSON.stringify(error)}`);
  }
}

export async function playerTransactions(
  hostId: string,
  clubCode: string,
  playerId: string
): Promise<Array<PlayerTransaction>> {
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

  try {
    const resp = await AccountingRepository.playerTransactions(club, player);
    return resp;
  } catch (error) {
    logger.error(`Failed with error: ${JSON.stringify(error)}`);
    throw new Error(`Failed with error: ${JSON.stringify(error)}`);
  }
}

export async function settlePlayerToPlayer(
  hostId: string,
  clubCode: string,
  fromPlayerId: string,
  toPlayerId: string,
  amount: number,
  notes: string
): Promise<boolean> {
  const host = await Cache.getPlayer(hostId);
  if (!host) {
    throw new Error(`Player ${hostId} is not found`);
  }
  const fromPlayer = await Cache.getPlayer(fromPlayerId);
  if (!fromPlayer) {
    throw new Error(`Player ${fromPlayerId} is not found`);
  }
  const toPlayer = await Cache.getPlayer(toPlayerId);
  if (!toPlayer) {
    throw new Error(`Player ${toPlayerId} is not found`);
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
  const fromClubMember = await Cache.getClubMember(
    fromPlayer.uuid,
    club.clubCode
  );
  if (!fromClubMember) {
    logger.error(
      `Player: ${fromPlayer.uuid} is not a member in club ${club.name}`
    );
    throw new Error(
      `Player: ${fromPlayer.uuid} is not a member in club ${club.name}`
    );
  }
  const toClubMember = await Cache.getClubMember(toPlayer.uuid, club.clubCode);
  if (!toClubMember) {
    logger.error(
      `Player: ${toPlayer.uuid} is not a member in club ${club.name}`
    );
    throw new Error(
      `Player: ${toPlayer.uuid} is not a member in club ${club.name}`
    );
  }

  try {
    const resp = await AccountingRepository.settlePlayerToPlayer(
      host,
      club,
      fromClubMember,
      toClubMember,
      fromPlayer,
      toPlayer,
      amount,
      notes
    );
    return resp;
  } catch (error) {
    logger.error(`Failed with error: ${JSON.stringify(error)}`);
    throw new Error(`Failed with error: ${JSON.stringify(error)}`);
  }
}

const resolvers: any = {
  Query: {
    clubTransactions: async (parent, args, ctx, info) => {
      return clubTransactions(ctx.req.playerId, args.clubCode);
    },
    playerTransactions: async (parent, args, ctx, info) => {
      return playerTransactions(ctx.req.playerId, args.clubCode, args.playerId);
    },
  },
  Mutation: {
    settlePlayerToPlayer: async (parent, args, ctx, info) => {
      return settlePlayerToPlayer(
        ctx.req.playerId,
        args.clubCode,
        args.fromPlayerId,
        args.toPlayerId,
        args.amount,
        args.notes
      );
    },
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
