import * as _ from 'lodash';
import {PlayerRepository} from '@src/repositories/player';
import {ClubRepository} from '@src/repositories/club';
import {getLogger} from '@src/utils/log';
import {GameRepository} from '@src/repositories/game';
import {Cache} from '@src/cache/index';
import {Player} from '@src/entity/player/player';

import {
  GameStatus,
  GameType,
  ClubMemberStatus,
  PlayerStatus,
  ClubStatus,
} from '@src/entity/types';
import {getHighHandsByGame} from './reward';
import {Nats} from '@src/nats';
import {ClubMessageRepository} from '@src/repositories/clubmessage';
import {HostMessageRepository} from '@src/repositories/hostmessage';
import {HandRepository} from '@src/repositories/hand';
import {HistoryRepository} from '@src/repositories/history';
const logger = getLogger('player');

async function getClubs(playerId: string): Promise<Array<any>> {
  const player = await PlayerRepository.getPlayerById(playerId);
  if (!player) {
    throw new Error('Player Not Found');
  }
  const clubMembers = await ClubRepository.getPlayerClubs(playerId);
  if (!clubMembers) {
    return [];
  }
  const clubs = _.map(clubMembers, x => {
    let isOwner = false;
    if (x.ownerId === player.id) {
      isOwner = true;
    }

    return {
      name: x.name,
      private: true,
      imageId: '',
      isOwner: isOwner,
      clubCode: x.clubCode,
      memberCount: parseInt(x.memberCount),
      clubStatus: ClubStatus[x.status],
      memberStatus: ClubMemberStatus[x.memberStatus],
      balance: x.balance,
      host: x.host,
    };
  });
  return clubs;
}

const resolvers: any = {
  Query: {
    myClubs: async (parent, args, ctx, info) => {
      return getMyClubs(ctx.req.playerId);
    },
    /**
     * For testing(Without Authorization)
     */
    allPlayers: async (parent, args, ctx, info) => {
      return getAllPlayers();
    },
    playerById: async (parent, args, ctx, info) => {
      return getPlayerById(ctx.req.playerId);
    },
    encryptionKey: async (parent, args, ctx, info) => {
      return getEncryptionKey(ctx.req.playerId);
    },
    liveGames: async (parent, args, ctx, info) => {
      return getLiveGames(ctx.req.playerId, args.clubCode);
    },

    pastGames: async (parent, args, ctx, info) => {
      return getPastGames(ctx.req.playerId);
    },

    myInfo: async (parent, args, ctx, info) => {
      return getPlayerInfo(ctx.req.playerId, args.getPrivs);
    },

    clubInfo: async (parent, args, ctx, info) => {
      const ret = await getClubPlayerInfo(ctx.req.playerId, args.clubCode);
      return ret;
    },
    searchClub: async (parent, args, ctx, info) => {
      const ret = await searchClub(ctx.req.playerId, args.clubCode);
      return ret;
    },
    liveAudioToken: async (parent, args, ctx, info) => {
      const ret = await getAudioToken(ctx.req.playerId, args.gameCode);
      return ret;
    },
    idsToPlayersInfo: async (parent, args, ctx, info) => {
      const ret = await idsToPlayerInfo(ctx.req.playerId, args.ids);
      return ret;
    },
    notes: async (parent, args, ctx, info) => {
      const ret = await getNotes(
        ctx.req.playerId,
        args.playerId,
        args.playerUuid
      );
      return ret;
    },
  },
  PlayerClub: {
    pendingMemberCount: async (parent, args, ctx, info) => {
      const pendingMemberCount = await getPendingApprovalCount(
        ctx.req.playerId,
        parent.clubCode
      );
      return pendingMemberCount;
    },
    unreadMessageCount: async (parent, args, ctx, info) => {
      const unreadCount = await getMessageUnreadCount(
        ctx.req.playerId,
        parent.clubCode
      );
      return unreadCount;
    },
    memberUnreadMessageCount: async (parent, args, ctx, info) => {
      const pendingMemberCount = await getMemberUnreadCount(
        ctx.req.playerId,
        parent.clubCode
      );
      return pendingMemberCount;
    },
    hostUnreadMessageCount: async (parent, args, ctx, info) => {
      const pendingMemberCount = await getHostMessageUnreadCount(
        ctx.req.playerId,
        parent.clubCode
      );
      return pendingMemberCount;
    },

    liveGameCount: async (parent, args, ctx, info) => {
      const count = await getLiveGameCount(parent.clubCode);
      return count;
    },
  },
  ClubInfo: {
    pendingMemberCount: async (parent, args, ctx, info) => {
      const pendingMemberCount = await getPendingApprovalCount(
        ctx.req.playerId,
        parent.clubCode
      );
      return pendingMemberCount;
    },
    unreadMessageCount: async (parent, args, ctx, info) => {
      const unreadCount = await getMessageUnreadCount(
        ctx.req.playerId,
        parent.clubCode
      );
      return unreadCount;
    },
    memberUnreadMessageCount: async (parent, args, ctx, info) => {
      const pendingMemberCount = await getMemberUnreadCount(
        ctx.req.playerId,
        parent.clubCode
      );
      return pendingMemberCount;
    },
    hostUnreadMessageCount: async (parent, args, ctx, info) => {
      const pendingMemberCount = await getHostMessageUnreadCount(
        ctx.req.playerId,
        parent.clubCode
      );
      return pendingMemberCount;
    },
  },
  Mutation: {
    createPlayer: async (parent, args, ctx, info) => {
      return createPlayer(args);
    },
    leaveClub: async (parent, args, ctx, info) => {
      return leaveClub(ctx.req.playerId, args);
    },
    updateFirebaseToken: async (parent, args, ctx, info) => {
      return updateFirebaseToken(ctx.req.playerId, args.token);
    },
    setNotes: async (parent, args, ctx, info) => {
      const ret = await setNotes(
        ctx.req.playerId,
        args.playerId,
        args.playerUuid,
        args.notes
      );
      return ret;
    },
    sendPlayerFcmMessage: async (parent, args, ctx, info) => {
      await sendPlayerFcmMessage(ctx.req.playerId, args.message);
    },
    changeDisplayName: async (parent, args, ctx, info) => {
      await changeDisplayName(ctx.req.playerId, args.name);
    },
  },
  Player: {
    clubs: async (parent, args, ctx, info) => {
      return getPlayerClubs(ctx.req.playerId, parent);
    },
  },
  LiveGame: {
    highHands: async (parent, args, ctx, info) => {
      return getHighHandsByGame(ctx.req.playerId, parent.gameCode);
    },
  },
  PastGame: {
    highHands: async (parent, args, ctx, info) => {
      return getHighHandsByGame(ctx.req.playerId, parent.gameCode);
    },
  },
};

export function getResolvers() {
  return resolvers;
}

export async function getMyClubs(playerId: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  return getClubs(playerId);
}

/**
 * For testing(Without Authorization)
 */
export async function getAllPlayers() {
  const players = await PlayerRepository.getPlayers();
  return _.map(players, x => {
    return {
      playerId: x.uuid,
      name: x.name,
      email: x.email,
      lastActiveTime: x.updatedAt,
    };
  });
}

export async function getPlayerById(playerId: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const player = await PlayerRepository.getPlayerById(playerId);
  if (!player) {
    throw new Error('Player not found');
  }
  return {
    uuid: player.uuid,
    id: player.id,
    name: player.name,
    email: player.email,
    lastActiveTime: player.updatedAt,
  };
}

export async function getEncryptionKey(playerId: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const player = await PlayerRepository.getPlayerById(playerId);
  if (!player) {
    throw new Error('Player not found');
  }
  return player.encryptionKey;
}

export async function getPlayerInfo(playerId: string, getPrivs: boolean) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const player = await PlayerRepository.getPlayerInfo(playerId);
  if (!player) {
    throw new Error('Player not found');
  }
  let privileges: any = {};
  if (getPrivs) {
    try {
      privileges = getPrivileges(playerId);
    } catch (err) {
      logger.error(
        `Exception caught when getting privileges ${err.toString()}`
      );
    }
  }
  return {
    uuid: player.uuid,
    id: player.id,
    name: player.name,
    email: player.email,
    lastActiveTime: player.updatedAt,
    channel: Nats.getPlayerChannel(player),
    privileges: privileges,
  };
}

export async function idsToPlayerInfo(playerId: string, ids: Array<number>) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const players = await PlayerRepository.idsToPlayerInfo(ids);
  return players.map(x => {
    return {
      uuid: x.uuid,
      id: x.id,
      name: x.name,
      email: x.email,
      lastActiveTime: x.updatedAt,
    };
  });
}

export async function getClubPlayerInfo(playerId: string, clubCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const clubMember = await Cache.getClubMember(playerId, clubCode, true);
  if (!clubMember) {
    throw new Error(`Player ${playerId} is not a club member`);
  }

  return {
    name: clubMember.club.name,
    myBalance: clubMember.balance,
    joinedAt: clubMember.joinedDate,
    gamesPlayed: clubMember.totalGames,
    isManager: clubMember.isManager,
    isOwner: clubMember.isOwner,
    status: ClubMemberStatus[clubMember.status],
    clubCode: clubCode,
  };
}

export async function searchClub(playerId: string, clubCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }

  const club = await ClubRepository.searchClub(clubCode);
  if (!club) {
    return null;
  }
  let ownerName = '';
  if (club.owner && club.owner instanceof Player) {
    club.owner = await Promise.resolve(club.owner);
    ownerName = club.owner.name;
  }
  return {
    name: club.name,
    ownerName: ownerName,
    status: ClubStatus[club.status],
  };
}

export async function createPlayer(args: any) {
  const errors = validate();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const playerInput = args.player;
    return PlayerRepository.createPlayer(
      playerInput.name,
      playerInput.email,
      playerInput.password,
      playerInput.deviceId,
      playerInput.isBot
    );
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to register Player');
  }

  function validate() {
    const errors = new Array<string>();
    if (!args.player) {
      errors.push('player object not found');
    }
    if (isEmpty(args.player.name)) {
      errors.push('name is a required field');
    }
    if (isEmpty(args.player.deviceId) && isEmpty(args.player.email)) {
      errors.push('deviceId or email should be specified');
    }
    if (!isEmpty(args.player.email) && isEmpty(args.player.password)) {
      errors.push('password should be specified');
    }

    return errors;

    function isEmpty(value: any) {
      return value === undefined || value === '';
    }
  }
}

export async function updateFirebaseToken(playerId: string, token: string) {
  try {
    await PlayerRepository.updateFirebaseToken(playerId, token);
    return true;
  } catch (err) {
    logger.error(`Failed to update firebase token. Error: ${err.toString}`);
    throw err;
  }
}

export async function leaveClub(playerId: string, args: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const isClubMember = await ClubRepository.isClubMember(
    args.clubCode,
    playerId
  );
  if (!isClubMember) {
    return ClubMemberStatus[ClubMemberStatus.LEFT];
  }
  await ClubRepository.leaveClub(args.clubCode, playerId);
  return ClubMemberStatus[ClubMemberStatus.LEFT];
}

export async function getPlayerClubs(playerId: string, parent: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  return getClubs(parent.playerId);
}

async function getLiveGames(playerId: string, clubCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const liveGames = await GameRepository.getLiveGames(playerId);
  let game: any;
  const ret = new Array<any>();
  const now = new Date();
  for (game of liveGames) {
    // skip other club games
    if (clubCode && game.clubCode !== clubCode) {
      continue;
    }

    const nowMilli = now.getTime();
    const startedAtMs = new Date(game.startedAt).getTime();
    const elapsedTime = nowMilli - startedAtMs;
    game.elapsedTime = Math.ceil(elapsedTime / 1000);
    game.status = GameStatus[game['gameStatus']];
    game.gameType = GameType[game['gameType']];
    if (!game['playerStatus']) {
      game.playerStatus = PlayerStatus.NOT_PLAYING;
    }
    game.playerStatus = PlayerStatus[game['playerStatus']];
    game.isTableFull = false;
    if (game.maxPlayers === game.tableCount) {
      game.isTableFull = true;
    }
    ret.push(game);
  }
  return ret;
}

async function getPastGames(playerId: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const pastGames = await HistoryRepository.getPastGames(playerId);
  let game: any;
  for (game of pastGames) {
    game.gameTime = Math.floor(game.gameTime);
    game.sessionTime = Math.floor(game.sessionTime);
    game.status = GameStatus[game['gameStatus']];
    game.gameType = GameType[game['gameType']];
    game.playerStatus = PlayerStatus[game['playerStatus']];
  }
  return pastGames;
}

async function getAudioToken(
  playerId: string,
  gameCode: string
): Promise<string> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  // get player info using uuid
  const playerInfo = await Cache.getPlayer(playerId);
  const gameExists = await Cache.getGame(gameCode);
  if (!gameExists) {
    throw new Error(`Game ${gameCode} does not exist`);
  }
  // get audio token for the player
  const token = GameRepository.getAudioToken(playerInfo, gameExists);
  logger.info(`Player: ${playerId} is using agora token for game ${gameCode}`);
  return token;
}

async function getNotes(
  playerId: string,
  notesPlayerId: number,
  notesPlayerUuid: string
): Promise<string> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  return PlayerRepository.getNotes(playerId, notesPlayerId, notesPlayerUuid);
}

async function setNotes(
  playerId: string,
  notesPlayerId: number,
  notesPlayerUuid: string,
  notes: string
): Promise<void> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  return await PlayerRepository.updateNotes(
    playerId,
    notesPlayerId,
    notesPlayerUuid,
    notes
  );
}

async function getPrivileges(playerId: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    // get club member count
    const [
      memberCount,
      ownerCount,
      managerCount,
    ] = await ClubRepository.getClubOwnerManagerCount(playerId);
    const hostingCount = await GameRepository.hostingCount(playerId);

    /*
      clubOwner: Boolean
      clubManager: Boolean
      gameHost: Boolean
    */

    const ret = {
      clubOwner: ownerCount > 0,
      clubManager: managerCount > 0,
      gameHost: hostingCount > 0,
    };
    return ret;
  } catch (err) {
    logger.error(`Exception caught when getting privileges ${err.toString()}`);
    throw new Error('Failed to get privilegts');
  }
}

export async function getPendingApprovalCount(
  playerId: string,
  clubCode: string
) {
  //logger.info(`Get unread message count club: ${clubCode} player: ${playerId}`);
  const club = await Cache.getClub(clubCode);
  const player = await Cache.getPlayer(playerId);
  if (!club || !player) {
    return 0;
  }
  const clubMember = await Cache.getClubMember(playerId, clubCode);
  if (!clubMember || !clubMember.isOwner) {
    return 0;
  }

  return ClubRepository.getPendingMemberCount(club);
}

export async function getHostMessageUnreadCount(
  playerId: string,
  clubCode: string
) {
  // logger.info(
  //   `Get unread host message unread count club: ${clubCode} player: ${playerId}`
  // );
  const club = await Cache.getClub(clubCode);
  const player = await Cache.getPlayer(playerId);
  if (!club || !player) {
    return 0;
  }
  const clubMember = await Cache.getClubMember(playerId, clubCode);
  if (!clubMember || !clubMember.isOwner) {
    return 0;
  }
  return HostMessageRepository.hostMessageUnreadCount(club);
}

export async function getMemberUnreadCount(playerId: string, clubCode: string) {
  // logger.info(
  //   `Get unread host message unread count club: ${clubCode} player: ${playerId}`
  // );
  const club = await Cache.getClub(clubCode);
  const player = await Cache.getPlayer(playerId);
  const clubMember = await Cache.getClubMember(playerId, clubCode);
  if (!club || !player || !clubMember) {
    return 0;
  }
  return HostMessageRepository.memberMessageUnreadCount(club, clubMember);
}

export async function getMessageUnreadCount(
  playerId: string,
  clubCode: string
) {
  // logger.info(
  //   `Get unread club message unread count club: ${clubCode} player: ${playerId}`
  // );
  const club = await Cache.getClub(clubCode);
  const player = await Cache.getPlayer(playerId);
  const clubMember = await Cache.getClubMember(playerId, clubCode);
  if (!club || !player || !clubMember) {
    return 0;
  }
  let count = 0;
  try {
    count = await ClubMessageRepository.getUnreadMessageCount(club, player);
  } catch (err) {
    logger.error(`Could not get unread message count. ${err.toString()}`);
  }
  return count;
}

export async function getLiveGameCount(clubCode: string) {
  logger.info(`Get live game count for club: ${clubCode}`);
  const club = await Cache.getClub(clubCode);
  if (!club) {
    return 0;
  }
  let count = 0;
  try {
    count = await GameRepository.getLiveGameCount(club);
  } catch (err) {
    logger.error(`Could not get unread message count. ${err.toString()}`);
  }
  return count;
}

async function sendPlayerFcmMessage(playerId: string, message: any) {
  const player = await Cache.getPlayer(playerId);
  if (!player) {
    throw new Error(`Player ${playerId} is not found`);
  }
  await PlayerRepository.sendFcmMessage(player, message);
}

export async function changeDisplayName(
  playerId: string,
  name: string
): Promise<boolean> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  return await PlayerRepository.changeDisplayName(playerId, name);
}
