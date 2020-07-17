import {createConnection, getConnectionOptions} from 'typeorm';
import {Player} from '@src/entity/player';
import {Club, ClubMember} from '@src/entity/club';
import {PokerGame, PokerGamePlayers, PokerHand} from '@src/entity/game';
import {HandWinners, HandHistory} from '@src/entity/hand';

export async function initializeSqlLite() {
  process.env.DB_USED = 'sqllite';
  await sqlliteConnection()
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
    ],
    dropSchema: true,
    synchronize: true,
    logging: false,    
  });
  return connection;
}
