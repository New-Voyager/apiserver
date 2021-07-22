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
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import {getJwtSecret} from './index';

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
  generateBotScript,
  generateBotScriptDebugHand,
  updateButtonPos,
} from './internal/bot';
import {restartTimers} from '@src/timer';
import {getUserRepository} from './repositories';
import {UserRegistrationPayload} from './types';
import {PlayerRepository} from './repositories/player';
export enum RunProfile {
  DEV,
  TEST,
  PROD,
}

const logger = getLogger('server');
const JWT_EXPIRY_DAYS = 3;
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
      const conn = await createConnection({
        type: defaultObj.type,
        host: defaultObj.host,
        port: defaultObj.port,
        username: defaultObj.username,
        password: defaultObj.password,
        database: process.env.DB_NAME,
        cache: defaultObj.cache,
        synchronize: defaultObj.synchronize,
        bigNumberStrings: defaultObj.bigNumberStrings,
        entities: defaultObj.entities,
        name: 'default',
      });
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
          type: userObj.type,
          host: userObj.host,
          port: userObj.port,
          username: userObj.username,
          password: userObj.password,
          database: 'users', //process.env.DB_NAME,
          cache: userObj.cache,
          synchronize: userObj.synchronize,
          bigNumberStrings: userObj.bigNumberStrings,
          entities: userObj.entities,
          name: 'users',
        },
        {
          type: liveGameObj.type,
          host: liveGameObj.host,
          port: liveGameObj.port,
          username: liveGameObj.username,
          password: liveGameObj.password,
          database: 'livegames', //process.env.DB_NAME,
          cache: liveGameObj.cache,
          synchronize: liveGameObj.synchronize,
          bigNumberStrings: liveGameObj.bigNumberStrings,
          entities: liveGameObj.entities,
          name: 'livegames',
        },
        {
          type: historyObj.type,
          host: historyObj.host,
          port: historyObj.port,
          username: historyObj.username,
          password: historyObj.password,
          database: 'history',
          cache: historyObj.cache,
          synchronize: historyObj.synchronize,
          bigNumberStrings: historyObj.bigNumberStrings,
          entities: historyObj.entities,
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

  initializeNats();
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
}

async function readyCheck(req: any, resp: any) {
  resp.status(200).send(JSON.stringify({status: 'OK'}));
}

/**
 * Login API
 * @param req
 * {
 *  "uuid": <player uuid>,
 *  "device-id": <uuid assigned in the device>,
 *  "email": "player email address",
 *  "password": "password"
 * }
 * The player can login using uuid/device-id or email/password.
 * @param resp
 */
async function login(req: any, resp: any) {
  const payload = req.body;
  const repository = getUserRepository(Player);

  const errors = new Array<string>();
  const name = payload['name'];
  const uuid = payload['uuid'];
  const deviceId = payload['device-id'];
  const email = payload['email'];
  const password = payload['password'];

  let player;
  if (email && password) {
    // use email and password to login
  } else {
    if (name) {
      // in test mode only
      logger.info(`[test] Player ${name} tries to login using name`);
      player = await repository.findOne({where: {name: name}});
      if (!player) {
        logger.error(`[test] Player ${name} does not exist`);
        throw new Error(`${name} user is not found`);
      }
    } else {
      if (!uuid || !deviceId) {
        errors.push('uuid and deviceId should be specified to login');
      }
    }
  }

  if (errors.length) {
    resp.status(500).send(JSON.stringify({errors: errors}));
    return;
  }

  if (!player) {
    if (email) {
      player = await repository.findOne({where: {email: email}});
    } else {
      player = await repository.findOne({where: {uuid: uuid}});
    }
  }

  if (!player) {
    resp.status(401).send(JSON.stringify({errors: ['Player is not found']}));
    return;
  }

  if (!name) {
    if (email) {
      if (password !== player.password) {
        resp.status(401).send(JSON.stringify({errors: ['Invalid password']}));
        return;
      }
    } else {
      if (deviceId !== player.deviceId) {
        resp.status(401).send(JSON.stringify({errors: ['Invalid device id']}));
        return;
      }
    }
  }

  const expiryTime = new Date();
  expiryTime.setDate(expiryTime.getDate() + JWT_EXPIRY_DAYS);
  const jwtClaims = {
    user: player.name,
    uuid: player.uuid,
    id: player.id,
    // iat: new Date(),
    // exp: expiryTime,
  };
  try {
    const jwt = generateAccessToken(jwtClaims);
    resp.status(200).send(JSON.stringify({jwt: jwt}));
  } catch (err) {
    logger.error(err.toString());
    resp.status(500).send({errors: ['JWT cannot be generated']});
  }
}

/**
 * Signup API
 * @param req
 * {
 *  "device-id": <uuid assigned in the device>,
 *  "screen-name": "player screen name",
 *  "display-name": "player name",
 *  "recovery-email": "recovery email address"
 * }
 *
 * A player is registered to the system using signup api
 * @param resp
 * {
 *   "device-secret": "device secret created for the user"
 * }
 */
async function signup(req: any, resp: any) {
  const payload = req.body;

  const name = payload['screen-name'];
  const deviceId = payload['device-id'];
  const recoveryEmail = payload['recovery-email'];
  const displayName = payload['display-name'];
  const bot = payload['bot'];

  const errors = new Array<string>();
  if (!name) {
    errors.push('screen-name field is required');
  }

  if (!deviceId) {
    errors.push('device-id field is required');
  }

  if (errors.length >= 1) {
    resp.status(400).send(JSON.stringify({errors: errors}));
    return;
  }

  const regPayload: UserRegistrationPayload = {
    name: name,
    deviceId: deviceId,
    recoveryEmail: recoveryEmail,
    displayName: displayName,
    bot: bot,
  };

  let player: Player;
  try {
    player = await PlayerRepository.registerUser(regPayload);
  } catch (err) {
    logger.error(err.toString());
    resp.status(500).send({errors: [err.toString()]});
    return;
  }

  try {
    const expiryTime = new Date();
    expiryTime.setDate(expiryTime.getDate() + JWT_EXPIRY_DAYS);
    const jwtClaims = {
      user: player.name,
      uuid: player.uuid,
      id: player.id,
    };
    const jwt = generateAccessToken(jwtClaims);
    const response = {
      'device-secret': player.deviceSecret,
      jwt: jwt,
      name: player.name,
      uuid: player.uuid,
      id: player.id,
    };
    resp.status(200).send(JSON.stringify(response));
  } catch (err) {
    logger.error(err.toString());
    resp.status(500).send({errors: ['JWT cannot be generated']});
  }
}

/**
 * Login API
 * @param req
 * {
 *  "device-id": <uuid assigned in the device>,
 *  "device-secret": device secret assigned to the device,
 * }
 *
 * Logs in as the user and returns a JWT
 * @param resp
 * {
 *   "jwt": "jwt for auth header"
 * }
 */
async function newlogin(req: any, resp: any) {
  const payload = req.body;

  const deviceId = payload['device-id'];
  const deviceSecret = payload['device-secret'];

  const errors = new Array<string>();
  if (!deviceId) {
    errors.push('device-id field is required');
  }

  if (!deviceSecret) {
    errors.push('device-secret field is required');
  }

  if (errors.length >= 1) {
    resp.status(400).send(JSON.stringify({errors: errors}));
    return;
  }

  let player: Player | null;
  try {
    player = await PlayerRepository.getPlayerUsingDeviceId(deviceId);
    if (!player) {
      resp
        .status(403)
        .send({errors: [`Player with device id ${deviceId} does not exist`]});
      return;
    }

    if (player.deviceSecret !== deviceSecret) {
      resp.status(403).send({
        errors: [`Login failed for ${deviceId}. Incorrect device secret.`],
      });
      return;
    }
  } catch (err) {
    logger.error(err.toString());
    resp.status(500).send({errors: ['Unexpected error']});
    return;
  }

  try {
    const expiryTime = new Date();
    expiryTime.setDate(expiryTime.getDate() + JWT_EXPIRY_DAYS);
    const jwtClaims = {
      user: player.name,
      uuid: player.uuid,
      id: player.id,
    };
    const jwt = generateAccessToken(jwtClaims);
    const response = {
      jwt: jwt,
      name: player.name,
      uuid: player.uuid,
      id: player.id,
    };
    resp.status(200).send(JSON.stringify(response));
  } catch (err) {
    logger.error(err.toString());
    resp.status(500).send({errors: ['JWT cannot be generated']});
  }
}

/**
 * Logs in using recovery email address
 *
 * @param req
 * {
 *  "recovery-email": recovery email address,
 *  "code": generated code,
 *  "device-id": device id
 * }
 *
 * @param resp
 * {
 *   "device-secret": device secret,
 *   "jwt": jwt for the user
 * }
 */
async function loginUsingRecoveryCode(req: any, resp: any) {
  const payload = req.body;

  const recoveryEmail = payload['recovery-email'];
  const code = payload['code'];
  const deviceId = payload['device-id'];

  if (!recoveryEmail) {
    resp.status(403).send({
      status: 'FAIL',
      error: 'Recovery email address is required',
    });
    return;
  }
  if (!code) {
    resp.status(403).send({
      status: 'FAIL',
      error: 'code is required',
    });
    return;
  }
  if (!deviceId) {
    resp.status(403).send({
      status: 'FAIL',
      error: 'New device id is required',
    });
    return;
  }

  let player: Player | null;
  try {
    player = await PlayerRepository.loginUsingRecoveryCode(
      deviceId,
      recoveryEmail,
      code
    );
    if (!player) {
      resp.status(403).send({
        status: 'FAIL',
        error: 'Recovery email address is not found',
      });
      return;
    }
  } catch (err) {
    logger.error(err.toString());
    resp.status(400).send({error: err.message});
    return;
  }

  try {
    const expiryTime = new Date();
    expiryTime.setDate(expiryTime.getDate() + JWT_EXPIRY_DAYS);
    const jwtClaims = {
      user: player.name,
      uuid: player.uuid,
      id: player.id,
    };
    const jwt = generateAccessToken(jwtClaims);
    const response = {
      'device-secret': player.deviceSecret,
      name: player.name,
      uuid: player.uuid,
      id: player.id,
      jwt: jwt,
    };
    resp.status(200).send(JSON.stringify(response));
  } catch (err) {
    logger.error(err.toString());
    resp.status(500).send({errors: ['JWT cannot be generated']});
  }
}

/**
 * Get recovery code API
 * @param req
 * {
 *  "recovery-email": recovery email address,
 * }
 *
 * Sends a code to recovery email address
 * @param resp
 * {
 *   "status": "OK"
 * }
 */
async function getRecoveryCode(req: any, resp: any) {
  const payload = req.body;

  const recoveryEmail = payload['recovery-email'];
  if (!recoveryEmail) {
    resp.status(403).send({
      status: 'FAIL',
      error: 'Recovery email address is not found',
    });
    return;
  }

  try {
    const ret = await PlayerRepository.sendRecoveryCode(recoveryEmail);
    if (!ret) {
      resp.status(403).send({
        status: 'FAIL',
        error: 'Recovery email address is not found',
      });
      return;
    }
    resp.status(200).send({status: 'OK'});
  } catch (err) {
    logger.error(err.toString());
    resp.status(500).send({status: 'FAIL', error: err.message});
    return;
  }
}

// username is in the form { username: "my cool username" }
// ^^the above object structure is completely arbitrary
function generateAccessToken(payload) {
  // expires after 3 days
  return jwt.sign(payload, getJwtSecret(), {expiresIn: `${JWT_EXPIRY_DAYS}d`});
}

// returns nats urls
async function natsUrls(req: any, resp: any) {
  resp.status(200).send(JSON.stringify({urls: process.env.NATS_URL}));
}

function initializeNats() {
  // throw new Error('Function not implemented.');
  if (!process.env.NATS_URL) {
    throw new Error('Nats url must be specified');
  }
  Nats.init(process.env.NATS_URL);
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
