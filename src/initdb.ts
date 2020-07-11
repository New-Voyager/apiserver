import {createConnection} from 'typeorm';
import {Player} from './entity/player';
import {Club, ClubMember} from './entity/club';
import {PokerGame, PokerGamePlayers, PokerHand} from './entity/game';
import {HandWinners, HandHistory} from './entity/hand';
import {getLogger} from '@src/utils/log';
const logger = getLogger('initdb');

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
      PokerGame,
      PokerHand,
      PokerGamePlayers,
      HandWinners,
      HandHistory,
    ],
    synchronize: true,
    logging: false,
  });
  return connection;
}

export async function initializeDB(connectionDB: any) {
  try {
    logger.debug('Initializing database');
    await connectionDB();
    logger.debug('Database is initialized');
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}
