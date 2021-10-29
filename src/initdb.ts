import {getConnections} from './ormconfig';
import {
  createConnection,
  createConnections,
  getConnectionOptions,
} from 'typeorm';
import {
  getGameConnection,
  getHistoryConnection,
  getUserConnection,
} from './repositories';
import {ChatTextRepository} from './repositories/chat';
import {StatsRepository} from './repositories/stats';
import {errToStr, getLogger} from './utils/log';

const systemChatText = [
  'Donkey call',
  'Runner Runner',
  'How can you run so lucky!',
  'Please fold',
  'Not my day!',
  'See you at the river',
  'Fish',
  'Nice hand!',
  'No gamble no future',
  'I got lucky',
];

const logger = getLogger('seed');

// initialize database with some default data
export async function seed() {
  try {
    for (const text of systemChatText) {
      await ChatTextRepository.addSystemChatText(text);
    }

    await StatsRepository.newSystemStats();
  } catch (err) {
    logger.error(`Error when seeding database. ${errToStr(err)}`);
    throw err;
  }
}

export async function initdb() {
  if (process.env.NODE_ENV !== 'unit-test') {
    logger.debug('Running in dev/prod mode');
    //const options = await getConnectionOptions('default');
    const options = getConnections();
    const users = options['users'];
    const livegames = options['livegames'];
    const history = options['history'];
    const default1 = options['default'];

    // create databases
    try {
      const defaultObj = default1 as any;
      const conn = await createConnection(defaultObj);
      try {
        logger.info('Enabling pg_stat_statements extension');
        await conn.query('CREATE EXTENSION pg_stat_statements');
        logger.info('Enabled pg_stat_statements extension');
      } catch (err) {
        logger.error(
          `Enabling pg_stat_statements extension failed. Error: ${errToStr(
            err
          )}`
        );
      }
      try {
        await conn.query('CREATE DATABASE livegames');
        await conn.query(
          `GRANT ALL PRIVILEGES ON DATABASE livegames TO "${defaultObj.username}"`
        );
      } catch (err) {
        const message: string = errToStr(err);
        if (message.indexOf('already exists') === -1) {
          throw err;
        }
      }
      try {
        await conn.query('CREATE DATABASE users');
        await conn.query(
          `GRANT ALL PRIVILEGES ON DATABASE users TO "${defaultObj.username}"`
        );
      } catch (err) {
        const message: string = errToStr(err);
        if (message.indexOf('already exists') === -1) {
          throw err;
        }
      }
      try {
        await conn.query('CREATE DATABASE history');
        await conn.query(
          `GRANT ALL PRIVILEGES ON DATABASE history TO "${defaultObj.username}"`
        );
      } catch (err) {
        const message: string = errToStr(err);
        if (message.indexOf('already exists') === -1) {
          throw err;
        }
      }
    } catch (err) {
      logger.error(
        `Errors reported when creating the database ${errToStr(err)}`
      );
      throw err;
    }

    // override database name if specified in the environment variable
    //if (process.env.DB_NAME) {
    const liveGameObj = livegames as any;
    const historyObj = history as any;
    const userObj = users as any;
    const debugObj = options['debug'] as any;
    try {
      await createConnections([
        {
          ...userObj,
          name: 'users',
        },
        {
          ...liveGameObj,
          name: 'livegames',
        },
        {
          ...historyObj,
          name: 'history',
        },
        {
          ...debugObj,
          name: 'debug',
        },
      ]);
    } catch (err) {
      logger.error(`Error creating connections: ${errToStr(err)}`);
      throw err;
    }
  } else {
    logger.debug('Running in UNIT-TEST mode');
    process.env.DB_USED = 'sqllite';

    try {
      const options = await getConnectionOptions('default');
      const users = options['users'];
      const livegames = options['livegames'];
      const history = options['history'];

      // override database name if specified in the environment variable
      //if (process.env.DB_NAME) {
      const liveGameObj = livegames as any;
      const historyObj = history as any;
      const userObj = users as any;

      await createConnections([
        {
          ...userObj,
          name: 'users',
        },
        {
          ...liveGameObj,
          name: 'livegames',
        },
        {
          ...historyObj,
          name: 'history',
        },
      ]);
    } catch (err) {
      logger.error(`Error creating connections: ${errToStr(err)}`);
    }
  }

  try {
    logger.info('Enabling pg_stat_statements extension in users db');
    await getUserConnection().query('CREATE EXTENSION pg_stat_statements');
    logger.info('Enabled pg_stat_statements extension in users db');
  } catch (err) {
    logger.error(
      `Enabling pg_stat_statements in users db extension failed. Error: ${errToStr(
        err
      )}`
    );
  }
  try {
    logger.info('Enabling pg_stat_statements extension in users db');
    await getGameConnection().query('CREATE EXTENSION pg_stat_statements');
    logger.info('Enabled pg_stat_statements extension in users db');
  } catch (err) {
    logger.error(
      `Enabling pg_stat_statements in users db extension failed. Error: ${errToStr(
        err
      )}`
    );
  }
  try {
    logger.info('Enabling pg_stat_statements extension in users db');
    await getHistoryConnection().query('CREATE EXTENSION pg_stat_statements');
    logger.info('Enabled pg_stat_statements extension in users db');
  } catch (err) {
    logger.error(
      `Enabling pg_stat_statements in users db extension failed. Error: ${errToStr(
        err
      )}`
    );
  }
}
