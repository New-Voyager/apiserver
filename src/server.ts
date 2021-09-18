import {ApolloServer} from 'apollo-server-express';
import {fileLoader, mergeTypes} from 'merge-graphql-schemas';
import {merge} from 'lodash';
import {authorize} from '@src/middlewares/authorization';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
const {
  ApolloServerPluginLandingPageGraphQLPlayground,
} = require('apollo-server-core');

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
  INT_TEST,
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
let apolloServer: any = null;

function setPgConversion() {
  const types = require('pg').types;
  types.setTypeParser(20, val => {
    return parseInt(val);
  });
  types.setTypeParser(1700, val => {
    return parseFloat(val);
  });
}

export function getApolloServer(options?: {intTest?: boolean}): ApolloServer {
  const typesArray1: Array<string> = fileLoader(
    __dirname + '/' + './graphql/*.graphql',
    {recursive: true}
  );
  const typesArray2: Array<string> = fileLoader(
    __dirname + '/' + '../../src/graphql/*.graphql',
    {recursive: true}
  );
  const allTypes = new Array<string>();
  allTypes.push(...typesArray1);
  allTypes.push(...typesArray2);

  const typeDefs = mergeTypes(allTypes, {all: true});
  let resolverFiles: any;
  let resolvers = {};
  let extensions = ['.js'];
  if ((runProfile = RunProfile.INT_TEST)) {
    extensions = ['.js', '.ts'];
  }
  try {
    const resolversDir2 = __dirname + '/' + '../build/src/resolvers/';
    if (fs.existsSync(resolversDir2)) {
      resolverFiles = fileLoader(resolversDir2, {
        recursive: true,
        extensions: extensions,
      });
      for (const resolverFile of resolverFiles) {
        resolvers = merge(resolvers, resolverFile.getResolvers());
      }
    }
  } catch (err) {
    console.error(err);
  }

  try {
    const resolversDir = __dirname + '/' + './resolvers/';
    if (fs.existsSync(resolversDir)) {
      resolverFiles = fileLoader(resolversDir, {
        recursive: true,
        extensions: extensions,
      });
      for (const resolverFile of resolverFiles) {
        resolvers = merge(resolvers, resolverFile.getResolvers());
      }
    }
  } catch (err) {
    console.error(err);
  }

  const server = new ApolloServer({
    typeDefs: typeDefs,
    resolvers,
    context: requestContext,
    plugins: [
      ApolloServerPluginLandingPageGraphQLPlayground({
        // options
      }),
    ],
  });
  return server;
}

export async function start(
  initializeFirebase: boolean,
  options?: {intTest?: boolean}
): Promise<[any, any, any]> {
  logger.debug('In start method');

  if (!process.env.NATS_URL) {
    throw new Error(
      'NATS_URL should be specified in the environment variable.'
    );
  }

  if (process.env.NODE_ENV) {
    const profile = process.env.NODE_ENV.toLowerCase();
    if (profile === 'prod') {
      runProfile = RunProfile.PROD;
    } else if (profile === 'test') {
      runProfile = RunProfile.TEST;
    } else if (profile === 'int-test') {
      runProfile = RunProfile.INT_TEST;
    } else {
      runProfile = RunProfile.DEV;
    }
  }
  logger.info(`Server is running ${RunProfile[runProfile].toString()} profile`);

  apolloServer = getApolloServer(options);
  getAppSettings().compressHandData = true;
  if (process.env.COMPRESS_HAND_DATA === 'false') {
    getAppSettings().compressHandData = false;
  }

  await initdb();
  if (process.env.NODE_ENV) {
    const profile = process.env.NODE_ENV.toLowerCase();
    if (profile === 'prod') {
      runProfile = RunProfile.PROD;
    } else if (profile === 'test') {
      runProfile = RunProfile.TEST;
    } else if (profile === 'int-test') {
      runProfile = RunProfile.INT_TEST;
    } else {
      runProfile = RunProfile.DEV;
    }
  }
  if (process.env.NODE_ENV !== 'unit-test' && process.env.NODE_ENV !== 'test') {
    await initializeNats();
  }

  initializeRedis();
  initializeGameServer();
  if (initializeFirebase && runProfile != RunProfile.INT_TEST) {
    await Firebase.init();
  }

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

  app.use(bodyParser.json());
  app.use(authorize);
  await apolloServer.start();
  //app.use(bodyParser.raw({ inflate: false, limit: '100kb', type: 'application/octet-stream' }));
  apolloServer.applyMiddleware({app});

  let httpServer;
  httpServer = app.listen(
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
  return [app, httpServer, apolloServer];
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
    case RunProfile.INT_TEST:
      return 'int-test';
  }
}

export function getApolloServerInstance() {
  return apolloServer;
}

export function notifyScheduler(): boolean {
  if (!process.env.NOTIFY_SCHEDULER) {
    return true;
  }

  if (process.env.NOTIFY_SCHEDULER === '0') {
    return false;
  }
  return true;
}
