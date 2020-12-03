import {createConnection, getConnectionOptions} from 'typeorm';
import {Player} from '@src/entity/player';
import {Club, ClubMember} from '@src/entity/club';
import {
  PokerGame,
  PokerGamePlayers,
  PokerHand,
  NextHandUpdates,
} from '@src/entity/game';
import {HandWinners, HandHistory, StarredHands} from '@src/entity/hand';
import {
  PlayerGameTracker,
  ClubGameRake,
  ClubChipsTransaction,
} from '@src/entity/chipstrack';
import {FavouriteMessage} from '@src/entity/clubfreqmessage';
import {ClubMessageInput} from '@src/entity/clubmessage';
import {GameServer, TrackGameServer} from '@src/entity/gameserver';
import {
  Promotion,
  GamePromotion,
  PromotionWinners,
} from '@src/entity/promotion';

export async function initializeSqlLite() {
  process.env.DB_USED = 'sqllite';
  await sqlliteConnection();
}

export async function sqlliteConnection() {
  const connection = await createConnection({
    name: 'default',
    type: 'sqlite',
    database: ':memory:',
    entities: [
      Player,
      Club,
      ClubMember,
      PokerGame,
      PokerHand,
      PokerGamePlayers,
      HandWinners,
      HandHistory,
      NextHandUpdates,
      StarredHands,
      PlayerGameTracker,
      ClubGameRake,
      ClubChipsTransaction,
      FavouriteMessage,
      ClubMessageInput,
      GameServer,
      TrackGameServer,
      Promotion,
      GamePromotion,
      PromotionWinners,
    ],
    dropSchema: true,
    synchronize: true,
    logging: false,
  });
  return connection;
}
