import {ApolloServer} from 'apollo-server-express';
import {fileLoader, mergeTypes} from 'merge-graphql-schemas';
import {create, merge} from 'lodash';
import {authorize} from '@src/middlewares/authorization';
import {
  ConnectionOptions,
  ConnectionOptionsReader,
  createConnection,
  getConnectionOptions,
  getRepository,
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
import {Player} from './entity/player';
import {initializeGameServer} from './gameserver';
import {timerCallback} from './repositories/timer';
import {seed} from './initdb';
var admin = require('firebase-admin');

var serviceAccount = {
  type: 'service_account',
  project_id: 'poker-club-app',
  private_key_id: '811278dd416bccf8abf0170f18f27dbfdc63a024',
  private_key:
    '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDmKAF1gpHuajJS\nQdPCz5UwKtuob3jQhKxUre6gTYt+A5EcJik4YcQfAQN9j4TZfnAldCzDE8ZOX0f4\nDBKX6Z1EABHBXy4pjS8tD5gVJseYh0u0j4op/lRLmrXWLsJX1c04CGeIhgVseYza\n8X3TxDIYRN2A9CQL5knEBuJQc3BJRzgDWffAIkm+iSwBpUME4nwY4OROY30Hv3iR\n1ONm0JdP0sjiEdy2dmLK00H+0Kw2vzHPWVInr+HuiYSWoJ/J15lhnpA3OYJ08beP\n6dZaxF67wzWGUQDYbOJsG+r5j0C5dV6zcG7kuNg/6NWLZzKXIkwXNUDUfE6HCBCb\nOV+oScJ5AgMBAAECggEABpXZhkQenOLvNXNjqBBH9nlS4t3ag1pLUwOo4ZQcJUQl\nXE7dXG1hs4Kvl8Y8PWmZV8q3pLtsgh3GmH9vpcJQRIlviugRdb7UdA1K7GDd26fv\nqNlTSBuIAv8Rx4L7x+us+ttZRrz/Pc2Bitqgsac6JG1pbvEIzEnvzXZmP4xDLFT1\nMDhVP8cirI4rfQGPUT9qrwqXEDdU7q6WTHYIu9bc1hXNS41g9Swx5bwBOHgDQ4rC\nBLsgK6NLQkp/IJpUccdSIztqNkSHYeocTWioeNM2c+gjSh0BSwV0PTw5J2VIw+kI\ngIJCvyUW/0iU9MvXaECuGkcCW+ZquX5RbE4bHZFlXQKBgQD8gwmlncyoisLYf3Il\ncFp1g8JOJo5GlNzs2X2qRoE/5MI92wmZmY0eycupYpMNjSEmI9NZ/yZREcH0lqUU\nbvf/cBq5pMUlCxYpFwAPbs7FeJn1Cq+VtJTIFua+2EYZ06wRfnxGf4KL2XmjTLWc\nYLNI7c0MNrvaf2Ivy4Jd9PlytQKBgQDpVelZhnQrBdFjXWQgRgPLrgB+b/COFAym\nezKTMXqUb3BUFBSSbxmYEjmfUqsTy156NEmJ19vUHcgu4GOMANYQ7GSn4a+01BEI\nfBZ6tienajaM6ib8uIFkOlZ73bT2Jx1MRlQ/c2/6d1oicJcacbDodVTKkSJ98Jl2\nGptggnPXNQKBgDJ3VfQ9p2t/4BU4021cGRgnbywDVKgSlFzZ0t23HZnRdGi8YBzM\nrYGbvxJpWw54SEnBGzp/Xf8R13u0p+V/kB0DILQ9lBElOBaaPC7ZbIXW5p4sto7q\n+llLCm7V9pyuy1LrvpawYTzmCAN1D07jnLFUpYhtX/n5P3xh5fo1Pa2JAoGBAIRy\n+OeRk8WMIuRlcd2EAMmQNsWOoxzzMo8Z5YZ6EpvJehiv4VGR8RRKXB0dHvE4gqOZ\npJizSBxq32QEiV1CaEDo/uXxDPz3V8faMCRt26qDdv2cOI9B6GjNWKQtIHiNkWrn\njRELZOfm8eoUwSEIoiQB3iSyJ8MXXPUWe1ZYFot1AoGBAPAmyAdhweZyNi6BKisN\n8cB1065QrE55lMb7EpXYi/xrAdTikDkBoQVA/00asdCNb7cvOt3YAq5vf3eU1Oqj\n+01d2sHkr1/cKbiCV0IkNAhlZjUYbUKxYkqP620/IhLGTg92pvRkmu97iEFaFVeS\n+Skb+Wi1OY3tn5fhdMUbYtlz\n-----END PRIVATE KEY-----\n',
  client_email:
    'firebase-adminsdk-e4h53@poker-club-app.iam.gserviceaccount.com',
  client_id: '101014893742098390947',
  auth_uri: 'https://accounts.google.com/o/oauth2/auth',
  token_uri: 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url:
    'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-e4h53%40poker-club-app.iam.gserviceaccount.com',
}; //require("poker-club-app-firebase-adminsdk-e4h53-811278dd41.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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

    // override database name if specified in the environment variable
    if (process.env.DB_NAME) {
      const optionsObj = options as any;
      await createConnection({
        type: optionsObj.type,
        host: optionsObj.host,
        port: optionsObj.port,
        username: optionsObj.username,
        password: optionsObj.password,
        database: process.env.DB_NAME,
        cache: optionsObj.cache,
        synchronize: optionsObj.synchronize,
        bigNumberStrings: optionsObj.bigNumberStrings,
        entities: optionsObj.entities,
        name: 'default',
      });
    } else {
      await createConnection(options);
    }
  } else {
    logger.debug('Running in TEST mode');
    process.env.DB_USED = 'sqllite';
    const options = await getConnectionOptions('test');
    await createConnection({...options, name: 'default'});
  }

  initializeNats();
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
  // initialize db
  await seed();
  return [app, httpServer];
}

function addInternalRoutes(app: any) {
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
    '/internal/timer-callback/gameId/:gameID/playerId/:playerID/purpose/:purpose',
    timerCallback
  );

  app.post('/internal/restart-games', GameServerAPI.restartGames);

  app.post(
    '/internal/save-hand/gameId/:gameId/handNum/:handNum',
    HandServerAPI.postHand
  );

  app.post('/auth/login', login);
  app.get('/nats-urls', natsUrls);
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

// returns nats urls
async function natsUrls(req: any, resp: any) {
  resp.status(200).send(JSON.stringify({urls: process.env.NATS_URL}));
}

function initializeNats() {
  // throw new Error('Function not implemented.');
}
