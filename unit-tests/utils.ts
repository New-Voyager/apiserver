import {createConnection, createConnections, getConnectionOptions} from 'typeorm';
import {Player, PlayerNotes} from '../src/entity/player/player';
import {Club, ClubMember} from '../src/entity/player/club';
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
} from '../src/entity/history/stats';
import {GameHistory} from '../src/entity/history/game';
import {HighHandHistory} from '../src/entity/history/hand';
import {PlayersInGame} from '../src/entity/history/player';
import {
  Reward,
} from '../src/entity/player/reward';
import {
  GameReward,
  GameRewardTracking,
  HighHand,
} from '../src/entity/game/reward';

import {Announcement} from '../src/entity/player/announcements';
import {ClubTokenTransactions} from '../src/entity/player/accounting';
import {
  ClubMessageInput,
  ClubHostMessages,
} from '../src/entity/player/clubmessage';
import {GameServer, TrackGameServer} from '../src/entity/game/gameserver';
import {HostSeatChangeProcess} from '../src/entity/game/seatchange';

export async function initializeSqlLite() {
  process.env.DB_USED = 'sqllite';
  await sqlliteConnection();
}

export async function sqlliteConnection1() {
  const connection = await createConnection({
    name: 'default',
    type: 'sqlite',
    database: ':memory:',
    entities: [
      Player,
      Club,
      ClubMember,
      PokerGame,
      HandHistory,
      NextHandUpdates,
      PlayerGameTracker,
      ClubMessageInput,
      GameServer,
      TrackGameServer,
      PokerGameUpdates,
      GameReward,
      GameRewardTracking,
      Reward,
      HighHand,
      SavedHands,
      ClubHostMessages,
      Announcement,
      ClubTokenTransactions,
      HostSeatChangeProcess,
      PlayerGameStats,
      PlayerNotes,
      PlayerHandStats,
      ClubStats,
      GameHistory,
      HighHandHistory,
      PlayersInGame,
    ],
    dropSchema: true,
    synchronize: true,
    logging: false,
  });
  return connection;
}

export async function sqlliteConnection() {
  const connection = await createConnections([{
    name: 'users',
    type: 'sqlite',
    database: ':memory:',
    entities: [
      Player,
      Club,
      ClubMember,
      ClubMessageInput,
      Reward,
      HighHand,
      SavedHands,
      ClubHostMessages,
      Announcement,
      ClubTokenTransactions,
      HostSeatChangeProcess,
      PlayerGameStats,
      PlayerNotes,
      PlayerHandStats,
      ClubStats,
    ],
    dropSchema: true,
    synchronize: true,
    logging: false,
  },{
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
      GameReward,
      GameRewardTracking,
    ],
    dropSchema: true,
    synchronize: true,
    logging: false,
  },{
    name: 'livegames',
    type: 'sqlite',
    database: ':memory:',
    entities: [
      HandHistory,
      GameHistory,
      HighHandHistory,
      PlayersInGame,
    ],
    dropSchema: true,
    synchronize: true,
    logging: false,
  }]);
  return connection;
}
