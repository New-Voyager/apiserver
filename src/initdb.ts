import {createConnection} from 'typeorm';
import {Player} from './entity/player';
import {Club, ClubMember} from './entity/club';
import {ClubMessageInput} from './entity/clubmessage'
import {PokerGame, PokerGamePlayers, PokerHand} from './entity/game';

export async function pgConnection() {
  const connection = await createConnection({
    type: 'postgres',
    host: '10.2.4.4',
    port: 5436,
    username: 'game',
    password: 'game',
    database: 'game',
    entities: [
      Player,
      Club,
      ClubMember,
      ClubMessageInput,
      PokerGame,
      PokerHand,
      PokerGamePlayers,
    ],
    synchronize: true,
    logging: false,
  });
  return connection;
}

export async function initializeDB(connectionDB: any) {
  try {
    console.log('Initializing database');
    await connectionDB();
    console.log('Database is initialized');
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
}
