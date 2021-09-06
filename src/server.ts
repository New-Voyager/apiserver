import {ApolloServer} from 'apollo-server-express';
import {fileLoader, mergeTypes} from 'merge-graphql-schemas';
import {merge} from 'lodash';
import {authorize} from '@src/middlewares/authorization';
import * as dotenv from 'dotenv';

const bodyParser = require('body-parser');
const GQL_PORT = 9501;
import {getLogger} from '@src/utils/log';
import {initializeGameServer} from './gameserver';
import {initdb, seed} from './initdb';
import {Firebase, getAppSettings} from './firebase';
import {Nats} from './nats';

import {initializeRedis} from './cache';
import {addInternalRoutes} from './routes';
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

  getAppSettings().compressHandData = true;
  if (process.env.COMPRESS_HAND_DATA === 'false') {
    getAppSettings().compressHandData = false;
  }

  await initdb();
  if (process.env.NODE_ENV !== 'unit-test' && process.env.NODE_ENV !== 'test') {
    await initializeNats();
  }

  initializeRedis();
  initializeGameServer();
  await Firebase.init();

  // get config vars
  dotenv.config();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  app = express();
  // const getRawBody = require('raw-body');
  // app.use(async (req, res, next) => {
  //   if (req.headers['content-type'] === 'application/octet-stream') {
  //     req.rawBody = await getRawBody(req);
  //   }
  //   next();
  // });

  app.use(authorize);
  app.use(bodyParser.json());
  //app.use(bodyParser.raw({ inflate: false, limit: '100kb', type: 'application/octet-stream' }));

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
