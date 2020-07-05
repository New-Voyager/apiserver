import {createConnection} from 'typeorm';
import {Player} from './entity/player';
import {Club, ClubMember} from './entity/club';
<<<<<<< HEAD
import {ClubMessageInput} from './entity/clubmessage'
=======
>>>>>>> 0c66e557c93820068a0bf60b82753f15a8e9224c
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
<<<<<<< HEAD
      ClubMessageInput,
=======
>>>>>>> 0c66e557c93820068a0bf60b82753f15a8e9224c
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
