import {
  createConnection,
  createConnections,
  getConnectionOptions,
} from 'typeorm';
import {Player, PlayerNotes} from '../src/entity/player/player';
import {Club, ClubMember, ClubMemberStat} from '../src/entity/player/club';
import {SavedHands} from '../src/entity/player/player';
import {
  PokerGame,
  NextHandUpdates,
  PokerGameUpdates,
} from '../src/entity/game/game';
import {HandHistory} from '../src/entity/history/hand';
import {PlayerGameTracker} from '../src/entity/game/player_game_tracker';
import {
  ClubStats,
  PlayerGameStats,
  PlayerHandStats,
  SystemStats,
} from '../src/entity/history/stats';
import {GameHistory} from '../src/entity/history/game';
import {HighHandHistory} from '../src/entity/history/hand';
import {PlayersInGame} from '../src/entity/history/player';
import {Reward} from '../src/entity/player/reward';
import { Promotion } from '../src/entity/player/promotion';
import {
  GameReward,
  GameRewardTracking,
  HighHand,
} from '../src/entity/game/reward';

import {Announcement} from '../src/entity/player/announcements';
import {ClubTokenTransactions} from '../src/entity/player/accounting';
import {CoinPurchaseTransaction, PlayerCoin, CoinConsumeTransaction} from '../src/entity/player/appcoin';

import {
  ClubMessageInput,
  ClubHostMessages,
} from '../src/entity/player/clubmessage';
import {GameServer, TrackGameServer} from '../src/entity/game/gameserver';
import {HostSeatChangeProcess} from '../src/entity/game/seatchange';
import {buyIn, configureGame, joinGame, startGame} from '../src/resolvers/game';
import {createPlayer, getPlayerById} from '../src/resolvers/player';
import {
  approveMember,
  createClub,
  getClubById,
  joinClub,
} from '../src/resolvers/club';
import {createGameServer} from '../src/internal/gameserver';

export async function initializeSqlLite() {
  process.env.DB_USED = 'sqllite';
  await sqlliteConnection();
}

export async function sqlliteConnection() {
  try {
    const connection = await createConnections([
      {
        name: 'users',
        type: 'sqlite',
        database: ':memory:',
        entities: [
          Player,
          Club,
          ClubMember,
          ClubMessageInput,
          Reward,
          SavedHands,
          ClubHostMessages,
          Announcement,
          ClubTokenTransactions,
          PlayerNotes,
          ClubMemberStat,
          CoinPurchaseTransaction,
          CoinConsumeTransaction,
          PlayerCoin,
          Promotion
        ],
        dropSchema: true,
        synchronize: true,
        logging: false,
      },
      {
        name: 'livegames',
        type: 'sqlite',
        database: ':memory:',
        entities: [
          PokerGame,
          NextHandUpdates,
          PlayerGameTracker,
          GameServer,
          TrackGameServer,
          PokerGameUpdates,
          HighHand,
          GameReward,
          GameRewardTracking,
          HostSeatChangeProcess,
        ],
        dropSchema: true,
        synchronize: true,
        logging: false,
      },
      {
        name: 'history',
        type: 'sqlite',
        database: ':memory:',
        entities: [
          HandHistory,
          GameHistory,
          HighHandHistory,
          PlayersInGame,
          PlayerHandStats,
          ClubStats,
          SystemStats,
          PlayerGameStats,
        ],
        dropSchema: true,
        synchronize: true,
        logging: false,
      },
    ]);
    return connection;
  } catch (err) {
    console.log(`Failed to create connections. ${err.toString()}`);
    throw err;
  }
}

export async function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export async function setupGameEnvironment(
  owner: string,
  club: string,
  players: Array<string>,
  buyin: number,
  gameInput: any,
): Promise<[string, number]> {
  const gameServer = {
    ipAddress: '10.1.1.1',
    currentMemory: 100,
    status: 'ACTIVE',
    url: 'htto://localhost:8080',
  };
  await createGameServer(gameServer);
  const game = await configureGame(owner, club, gameInput);
  let i = 1;
  for await (const player of players) {
    await joinGame(player, game.gameCode, i);
    await buyIn(player, game.gameCode, buyin);
    i++;
  }
  await startGame(owner, game.gameCode);
  return [game.gameCode, game.id];
}


export async function createClubWithMembers(
  ownerInput: any,
  clubInput: any,
  players: Array<any>
): Promise<[string, string, number, Array<string>, Array<number>]> {
  const ownerUuid = await createPlayer({player: ownerInput});
  clubInput.ownerUuid = ownerUuid;
  const clubCode = await createClub(ownerUuid, clubInput);
  const clubId = await getClubById(ownerUuid, clubCode);
  const playerUuids = new Array<string>();
  const playerIds = new Array<number>();
  for (const playerInput of players) {
    const playerUuid = await createPlayer({player: playerInput});
    const playerId = (await getPlayerById(playerUuid)).id;
    await joinClub(playerUuid, clubCode);
    await approveMember(ownerUuid, clubCode, playerUuid);
    playerUuids.push(playerUuid);
    playerIds.push(playerId);
  }
  return [ownerUuid, clubCode, clubId, playerUuids, playerIds];
}