import {ApolloServer} from 'apollo-server-express';
import {fileLoader, mergeTypes} from 'merge-graphql-schemas';
import {create, merge} from 'lodash';
import {authorize} from '@src/middlewares/authorization';
import {
  createConnection,
  createConnections,
  getConnectionOptions,
} from 'typeorm';
import {GameServerAPI} from './internal/gameserver';
import {HandServerAPI} from './internal/hand';
import {GameAPI} from './internal/game';
import * as dotenv from 'dotenv';

const bodyParser = require('body-parser');
const GQL_PORT = 9501;
import {getLogger} from '@src/utils/log';
import {AdminAPI} from './internal/admin';
import {Player} from './entity/player/player';
import {initializeGameServer} from './gameserver';
import {timerCallback} from './repositories/timer';
import {seed} from './initdb';
import {Firebase} from './firebase';
import {Nats} from './nats';
import {
  buyBotCoins,
  generateBotScript,
  generateBotScriptDebugHand,
  resetServerSettings,
  setServerSettings,
  updateButtonPos,
} from './internal/bot';
import {restartTimers} from '@src/timer';
import {getUserRepository} from './repositories';
import {UserRegistrationPayload} from './types';
import {PlayerRepository} from './repositories/player';
import {
  getRecoveryCode,
  login,
  loginUsingRecoveryCode,
  newlogin,
  signup,
} from './auth';
import {DevRepository} from './repositories/dev';
export enum RunProfile {
  DEV,
  TEST,
  PROD,
}

const logger = getLogger('server');
const requestContext = async ({req}) => {
  const ctx = {
    req: req,
  };
  return ctx;
};

let app: any = null;
let runProfile: RunProfile = RunProfile.DEV;

function setPgConversion() {
  const types = require('pg').types;
  types.setTypeParser(20, val => {
    return parseInt(val);
  });
  types.setTypeParser(1700, val => {
    return parseFloat(val);
  });
}

export async function start(dbConnection?: any): Promise<[any, any]> {
  logger.debug('In start method');

  if (!process.env.NATS_URL) {
    throw new Error(
      'NATS_URL should be specified in the environment variable.'
    );
  }

  const typesArray = fileLoader(
    __dirname + '/' + '../../src/graphql/*.graphql',
    {recursive: true}
  );
  const typeDefs1 = mergeTypes(typesArray, {all: true});

  const resolversDir = __dirname + '/' + './resolvers/';
  const resolversFiles = fileLoader(resolversDir, {
    recursive: true,
    extensions: ['.js'],
  });
  let resolvers = {};
  for (const resolverFile of resolversFiles) {
    resolvers = merge(resolvers, resolverFile.getResolvers());
  }

  const server = new ApolloServer({
    typeDefs: typeDefs1,
    resolvers,
    context: requestContext,
  });

  if (process.env.NODE_ENV) {
    const profile = process.env.NODE_ENV.toLowerCase();
    if (profile === 'prod') {
      runProfile = RunProfile.PROD;
    } else if (profile === 'test') {
      runProfile = RunProfile.TEST;
    } else {
      runProfile = RunProfile.DEV;
    }
  }

  logger.info(`Server is running ${RunProfile[runProfile].toString()} profile`);

  if (process.env.NODE_ENV !== 'unit-test' && process.env.NODE_ENV !== 'test') {
    logger.debug('Running in dev/prod mode');
    const options = await getConnectionOptions('default');
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
      } catch(err) {
        logger.error(`Enabling pg_stat_statements extension failed. Error: ${err.message}`);
      }
      try {
        await conn.query('CREATE DATABASE livegames');
        await conn.query(
          `GRANT ALL PRIVILEGES ON DATABASE livegames TO "${defaultObj.username}"`
        );
      } catch (err) {
        const message: string = err.toString();
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
        const message: string = err.toString();
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
        const message: string = err.toString();
        if (message.indexOf('already exists') === -1) {
          throw err;
        }
      }
    } catch (err) {
      logger.error(
        `Errors reported when creating the database ${err.toString()}`
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
      logger.error(`Error creating connections: ${err.toString()}`);
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
      logger.error(`Error creating connections: ${err.toString()}`);
    }
  }

  await initializeNats();
  initializeGameServer();
  await Firebase.init();

  // get config vars
  dotenv.config();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  app = express();
  app.use(authorize);
  app.use(bodyParser.json());
  server.applyMiddleware({app});

  const httpServer = app.listen(
    {
      port: GQL_PORT,
    },
    async () => {
      logger.info(`🚀 Server ready at http://0.0.0.0:${GQL_PORT}/graphql}`);
    }
  );
  setPgConversion();
  addInternalRoutes(app);
  // initialize db
  await seed();
  return [app, httpServer];
}

function addInternalRoutes(app: any) {
  app.get('/internal/ready', readyCheck);
  app.post('/internal/register-game-server', GameServerAPI.registerGameServer);
  app.post('/internal/update-game-server', GameServerAPI.updateGameServer);
  app.get('/internal/game-servers', GameServerAPI.getGameServers);
  app.post(
    '/internal/post-hand/gameId/:gameId/handNum/:handNum',
    HandServerAPI.postHand
  );
  app.post(
    '/internal/save-hand/gameId/:gameId/handNum/:handNum',
    HandServerAPI.saveHand
  );

  app.post('/internal/start-game', GameAPI.startGame);
  app.post('/internal/delete-club-by-name/:clubName', AdminAPI.deleteClub);
  app.post('/internal/update-player-game-state', GameAPI.updatePlayerGameState);
  app.post('/internal/update-table-status', GameAPI.updateTableStatus);
  app.get(
    '/internal/any-pending-updates/gameId/:gameId',
    GameAPI.anyPendingUpdates
  );
  app.post(
    '/internal/process-pending-updates/gameId/:gameId',
    GameAPI.processPendingUpdates
  );
  app.get(
    '/internal/get-game-server/game_num/:gameCode',
    GameServerAPI.getSpecificGameServer
  );

  app.get(
    '/internal/get-game/club_id/:clubCode/game_num/:gameCode',
    GameAPI.getGame
  );

  app.get('/internal/game-info/game_num/:gameCode', GameAPI.getGameInfo);

  app.get(
    '/internal/next-hand-info/game_num/:gameCode',
    GameAPI.getNextHandInfo
  );

  app.post(
    '/internal/move-to-next-hand/game_num/:gameCode/hand_num/:currentHandNum',
    GameAPI.moveToNextHand
  );

  app.post(
    '/internal/timer-callback/gameId/:gameID/playerId/:playerID/purpose/:purpose',
    timerCallback
  );

  app.post('/internal/restart-games', GameServerAPI.restartGames);
  app.post('/internal/restart-timers', restartTimers);

  app.post(
    '/internal/save-hand/gameId/:gameId/handNum/:handNum',
    HandServerAPI.postHand
  );

  app.post('/auth/login', login);
  app.post('/auth/new-login', newlogin);
  app.post('/auth/signup', signup);
  app.post('/auth/recovery-code', getRecoveryCode);
  app.post('/auth/login-recovery-code', loginUsingRecoveryCode);

  app.get('/nats-urls', natsUrls);
  app.get('/assets', getAssets);

  //app.get('/bot-script/game-code/:gameCode', generateBotScript);
  app.get('/bot-script/game-code/:gameCode/hand/:handNum', generateBotScript);
  app.get(
    '/bot-script/debug/game-code/:gameCode/hand/:handNum',
    generateBotScriptDebugHand
  );

  app.post(
    '/bot-script/game-code/:gameCode/button-pos/:buttonPos',
    updateButtonPos
  );
  app.post('/bot-script/server-settings', setServerSettings);
  app.post('/bot-script/reset-server-settings', resetServerSettings);
  app.post('/bot-script/buy-bot-coins', buyBotCoins);

  // admin apis
  app.get('/admin/feature-requests', DevRepository.featureRequests);
  app.get('/admin/bug-reports', DevRepository.bugReports);
}

async function readyCheck(req: any, resp: any) {
  resp.status(200).send(JSON.stringify({status: 'OK'}));
}

// returns nats urls
async function natsUrls(req: any, resp: any) {
  let natsUrl = process.env.NATS_URL;
  if (process.env.DEBUG_NATS_URL) {
    natsUrl = process.env.DEBUG_NATS_URL;
  }
  resp.status(200).send(JSON.stringify({urls: natsUrl}));
}

// returns all assets from the firebase
async function getAssets(req: any, resp: any) {
  const assets = await Firebase.getAllAssets();
  resp.status(200).send(JSON.stringify({assets: assets}));
}

async function initializeNats() {
  // throw new Error('Function not implemented.');
  if (!process.env.NATS_URL) {
    throw new Error('Nats url must be specified');
  }
  await Nats.init(process.env.NATS_URL);
}

export function getRunProfile(): RunProfile {
  return runProfile;
}

export function getRunProfileStr(): string {
  switch (runProfile) {
    case RunProfile.DEV:
      return 'dev';
    case RunProfile.PROD:
      return 'prod';
    case RunProfile.TEST:
      return 'test';
  }
}
