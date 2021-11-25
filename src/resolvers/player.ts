import * as _ from 'lodash';
import {PlayerRepository} from '@src/repositories/player';
import {ClubRepository} from '@src/repositories/club';
import {errToStr, getLogger} from '@src/utils/log';
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
import {HistoryRepository} from '@src/repositories/history';
import {PromotionRepository} from '@src/repositories/promotion';
import {PlayersInGameRepository} from '@src/repositories/playersingame';
import {centsToChips} from '@src/utils';
const logger = getLogger('resolvers::player');

async function getClubs(playerId: string): Promise<Array<any>> {
  const player = await PlayerRepository.getPlayerById(playerId);
  if (!player) {
    throw new Error('Player Not Found');
  }
  let clubMembers = await ClubRepository.getPlayerClubs(playerId);
  if (!clubMembers) {
    return [];
  }
  clubMembers = clubMembers.filter(
    x =>
      x.memberStatus == ClubMemberStatus.ACTIVE ||
      x.memberStatus == ClubMemberStatus.PENDING
  );

  const clubs = _.map(clubMembers, x => {
    let isOwner = false;
    if (x.ownerId === player.id) {
      isOwner = true;
    }

    return {
      name: x.name,
      picUrl: x.picUrl,
      private: true,
      imageId: '',
      isOwner: isOwner,
      clubCode: x.clubCode,
      memberCount: parseInt(x.memberCount),
      clubStatus: ClubStatus[x.status],
      memberStatus: ClubMemberStatus[x.memberStatus],
      availableCredit: x.availableCredit,
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
    notesForPlayers: async (parent, args, ctx, info) => {
      const ret = await getNotesForPlayers(ctx.req.playerId, args.playerIds);
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
    updatePlayer: async (parent, args, ctx, info) => {
      return updatePlayer(ctx.req.playerId, args);
    },
    leaveClub: async (parent, args, ctx, info) => {
      return leaveClub(ctx.req.playerId, args);
    },
    updateFirebaseToken: async (parent, args, ctx, info) => {
      return updateFirebaseToken(ctx.req.playerId, args.token);
    },
    updateLocation: async (parent, args, ctx, info) => {
      return updateLocation(ctx.req.playerId, '', args.location);
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
      return changeDisplayName(ctx.req.playerId, args.name);
    },
    redeemPromotionCode: async (parent, args, ctx, info) => {
      return redeemPromotionCode(ctx.req.playerId, args.code);
    },
    ipChanged: async (parent, args, ctx, info) => {
      const player = await Cache.getPlayer(ctx.req.playerId);
      if (ctx.req.userIp !== player.ipAddress) {
        return updateLocation(ctx.req.playerId, ctx.req.userIp, undefined);
      }
      return false;
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
  const clubs = await getClubs(playerId);
  return myClubsToClientUnits(clubs);
}

function myClubsToClientUnits(input: Array<any>): any {
  const resp = new Array<any>();
  for (const i of input) {
    const r = {...i};
    r.availableCredit = centsToChips(r.availableCredit);
    resp.push(r);
  }

  return resp;
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
      displayName: x.displayName,
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
    displayName: player.displayName,
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
      logger.error(`Exception caught when getting privileges ${errToStr(err)}`);
    }
  }
  return {
    uuid: player.uuid,
    id: player.id,
    name: player.name,
    displayName: player.displayName,
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
      displayName: x.displayName,
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

  const club = await Cache.getClub(clubCode);
  if (!club) {
    throw new Error(`Club code: ${clubCode} is not found`);
  }
  let ret: any = {
    name: club.name,
    description: club.description,
    picUrl: club.picUrl,
    myBalance: clubMember.availableCredit,
    joinedAt: clubMember.joinedDate,
    // gamesPlayed: clubMember.totalGames,
    isManager: clubMember.isManager,
    isOwner: clubMember.isOwner,
    status: ClubMemberStatus[clubMember.status],
    clubCode: clubCode,
    showHighRankStats: club.showHighRankStats,
    trackMemberCredit: club.trackMemberCredit,
    availableCredit: club.trackMemberCredit ? clubMember.availableCredit : 0,
  };
  ret.managerRole = ClubRepository.getManagerRole(clubCode);

  return clubInfoToClientUnits(ret);
}

function clubInfoToClientUnits(input: any): any {
  const resp = {...input};
  resp.myBalance = centsToChips(resp.myBalance);
  resp.availableCredit = centsToChips(resp.availableCredit);
  return resp;
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

export async function updatePlayer(playerId: string, args: any) {
  try {
    const playerInput = args.input;
    if (playerInput.name) {
      if (playerInput.name.length === 0) {
        throw new Error('name field cannot be empty');
      }
    }
    return PlayerRepository.updatePlayer(
      playerId,
      playerInput.name,
      playerInput.email,
      playerInput.displayName
    );
  } catch (err) {
    logger.error(err);
    throw new Error('Failed to update player');
  }
}

export async function updateFirebaseToken(playerId: string, token: string) {
  try {
    await PlayerRepository.updateFirebaseToken(playerId, token);
    return true;
  } catch (err) {
    logger.error(`Failed to update firebase token. Error: ${errToStr(err)}`);
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
  const clubs = await getClubs(parent.playerId);
  return myClubsToClientUnits(clubs);
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
  return liveGamesToClientUnits(ret);
}

function liveGamesToClientUnits(input: Array<any>): any {
  const resp = new Array<any>();
  for (const i of input) {
    const r = {...i};
    r.buyInMin = centsToChips(r.buyInMin);
    r.buyInMax = centsToChips(r.buyInMax);
    r.smallBlind = centsToChips(r.smallBlind);
    r.bigBlind = centsToChips(r.bigBlind);
    resp.push(r);
  }

  return resp;
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
  return pastGamesToClientUnits(pastGames);
}

function pastGamesToClientUnits(input: Array<any>): any {
  const resp = new Array<any>();
  for (const i of input) {
    const r = {...i};
    r.smallBlind = centsToChips(r.smallBlind);
    r.bigBlind = centsToChips(r.bigBlind);
    r.buyIn = centsToChips(r.buyIn);
    r.stack = centsToChips(r.stack);
    r.balance = centsToChips(r.balance);

    resp.push(r);
  }

  return resp;
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
  const token = await PlayersInGameRepository.getAudioToken(
    playerInfo,
    gameExists
  );
  logger.info(
    `Player: ${playerId} is using agora token ${token} for game ${gameCode}`
  );
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

async function getNotesForPlayers(
  playerId: string,
  playerIds: Array<number>
): Promise<Array<any>> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  return PlayerRepository.getNotesForPlayers(playerId, playerIds);
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
    const [memberCount, ownerCount, managerCount] =
      await ClubRepository.getClubOwnerManagerCount(playerId);
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
    logger.error(`Exception caught when getting privileges ${errToStr(err)}`);
    throw new Error('Failed to get privileges');
  }
}

export async function getPendingApprovalCount(
  playerId: string,
  clubCode: string
) {
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
    logger.error(`Could not get unread message count. ${errToStr(err)}`);
  }
  return count;
}

export async function getLiveGameCount(clubCode: string) {
  logger.debug(`Get live game count for club: ${clubCode}`);
  const club = await Cache.getClub(clubCode);
  if (!club) {
    return 0;
  }
  let count = 0;
  try {
    count = await GameRepository.getLiveGameCount(club);
  } catch (err) {
    logger.error(`Could not get unread message count. ${errToStr(err)}`);
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

export async function redeemPromotionCode(
  playerId: string,
  code: string
): Promise<any> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  return await PromotionRepository.redeemPromotionCode(playerId, code);
}

export async function updateLocation(
  playerUuid: string,
  ip: string,
  location: any
) {
  // update player location
  const player = await Cache.getPlayer(playerUuid);
  if (!player) {
    throw new Error(`Player ${playerUuid} is not found`);
  }
  logger.info(
    `Location Update: Player: ${player.name} location: ${JSON.stringify(
      location
    )}`
  );
  await Cache.updatePlayerLocation(playerUuid, location, ip);
  return true;
}
