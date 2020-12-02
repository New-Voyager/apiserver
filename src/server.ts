import {ApolloServer} from 'apollo-server-express';
import {fileLoader, mergeTypes} from 'merge-graphql-schemas';
import {merge, uniqueId} from 'lodash';
import {authorize} from '@src/middlewares/authorization';
import {createConnection, getConnectionOptions, getRepository} from 'typeorm';
import {GameServerAPI} from './internal/gameserver';
import {HandServerAPI} from './internal/hand';
import {ChipsTrackSeverAPI} from './internal/chipstrack';
import {GameAPI} from './internal/game';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import {getJwtSecret} from './index';

const bodyParser = require('body-parser');
const GQL_PORT = 9501;
import {getLogger} from '@src/utils/log';
import {AdminAPI} from './internal/admin';
import {Player} from './entity/player';
import {initializeGameServer} from './gameserver';
const logger = getLogger('server');
const JWT_EXPIRY_DAYS = 3;
const requestContext = async ({req}) => {
  const ctx = {
    req: req,
  };
  return ctx;
};

let app: any = null;

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
  resolversFiles.forEach(element => {
    resolvers = merge(resolvers, element.getResolvers());
  });

  const server = new ApolloServer({
    typeDefs: typeDefs1,
    resolvers,
    context: requestContext,
  });

  if (process.env.NODE_ENV !== 'test') {
    logger.debug('Running in dev/prod mode');
    const options = await getConnectionOptions('default');
    await createConnection(options);
  } else {
    logger.debug('Running in TEST mode');
    process.env.DB_USED = 'sqllite';
    const options = await getConnectionOptions('test');
    await createConnection({...options, name: 'default'});
  }

  //initializeNats();
  initializeGameServer();

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
      logger.error(`🚀 Server ready at http://0.0.0.0:${GQL_PORT}/graphql}`);
    }
  );
  setPgConversion();
  addInternalRoutes(app);
  return [app, httpServer];
}

function addInternalRoutes(app: any) {
  app.post('/internal/register-game-server', GameServerAPI.registerGameServer);
  app.post('/internal/update-game-server', GameServerAPI.updateGameServer);
  app.get('/internal/game-servers', GameServerAPI.getGameServers);
  app.post('/internal/save-hand', HandServerAPI.saveHand);
  app.post('/internal/start-game', GameAPI.startGame);
  app.post('/internal/player-sit-in', ChipsTrackSeverAPI.playerSitsIn);
  app.post('/internal/game-ended', ChipsTrackSeverAPI.endGame);
  app.post('/internal/buy-chips', ChipsTrackSeverAPI.buyChips);
  app.post('/internal/delete-club-by-name/:clubName', AdminAPI.deleteClub);
  // app.post('/internal/update-game-status', GameAPI.updateGameStatus);
  app.post('/internal/update-player-game-state', GameAPI.updatePlayerGameState);
  app.post('/internal/handle-seat-change', GameAPI.handleSeatChange);
  app.post(
    '/internal/update-break-time/gameId/:gameId/playerId/:playerId',
    GameAPI.updateBreakTime
  );
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
    '/internal/get-game-server/club_id/:clubCode/game_num/:gameCode',
    GameServerAPI.getSpecificGameServer
  );

  app.get(
    '/internal/get-game-server/club_id/:clubCode/game_num/:gameCode',
    GameAPI.getGame
  );

  app.post('/auth/login', login);
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
  const repository = getRepository(Player);

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

// username is in the form { username: "my cool username" }
// ^^the above object structure is completely arbitrary
function generateAccessToken(payload) {
  // expires after 3 days
  return jwt.sign(payload, getJwtSecret(), {expiresIn: `${JWT_EXPIRY_DAYS}d`});
}
