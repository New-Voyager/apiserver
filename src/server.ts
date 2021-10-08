import {ApolloServer} from 'apollo-server-express';
import {fileLoader, mergeTypes} from 'merge-graphql-schemas';
import {merge} from 'lodash';
import {authorize} from '@src/middlewares/authorization';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginLandingPageDisabled,
} from 'apollo-server-core';

import bodyParser from 'body-parser';
const GQL_PORT = 9501;
const INTERNAL_PORT = 9502;
import {getLogger} from '@src/utils/log';
import {initializeGameServer} from './gameserver';
import {initdb, seed} from './initdb';
import {Firebase, getAppSettings} from './firebase';
import {Nats} from './nats';
import {initializeRedis} from './cache';
import {addExternalRoutes, addInternalRoutes} from './routes';
import {DigitalOcean} from './digitalocean';
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

let externalApp: any = null;
let internalApp: any = null;
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
      process.env.NODE_ENV === 'prod'
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageGraphQLPlayground({
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

  logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
  logger.info(`NATS_URL: ${process.env.NATS_URL}`);
  logger.info(`EXTERNAL_NATS_URL: ${process.env.EXTERNAL_NATS_URL}`);
  if (!process.env.NATS_URL) {
    throw new Error(
      'NATS_URL should be specified in the environment variable.'
    );
  }

  logger.info(`INTERNAL_ENDPOINTS: ${process.env.INTERNAL_ENDPOINTS}`);
  logger.info(`EXTERNAL_ENDPOINTS: ${process.env.EXTERNAL_ENDPOINTS}`);
  if (!shouldExposeExternalEndpoints() && !shouldExposeInternalEndpoints()) {
    throw new Error(
      'Either EXTERNAL_ENDPOINTS or INTERNAL_ENDPOINTS must be set to 1'
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
  if (runProfile != RunProfile.INT_TEST) {
    if (initializeFirebase) {
      await Firebase.init();
    }
    DigitalOcean.initialize();
  }

  // get config vars
  dotenv.config();

  setPgConversion();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const express = require('express');
  let externalServer: any;
  let internalServer: any;
  if (shouldExposeExternalEndpoints()) {
    externalApp = express();
    // const getRawBody = require('raw-body');
    // app.use(async (req, res, next) => {
    //   if (req.headers['content-type'] === 'application/octet-stream') {
    //     req.rawBody = await getRawBody(req);
    //   }
    //   next();
    // });

    externalApp.use(bodyParser.json());
    externalApp.use(authorize);
    //app.use(bodyParser.raw({ inflate: false, limit: '100kb', type: 'application/octet-stream' }));

    await apolloServer.start();
    apolloServer.applyMiddleware({app: externalApp});

    addExternalRoutes(externalApp);
    externalServer = externalApp.listen(
      {
        port: GQL_PORT,
      },
      async () => {
        logger.info(`🚀 Server ready at http://0.0.0.0:${GQL_PORT}`);
      }
    );
  }

  if (shouldExposeInternalEndpoints()) {
    internalApp = express();
    internalApp.use(bodyParser.json());
    internalApp.use(authorize);
    addInternalRoutes(internalApp);
    internalServer = internalApp.listen(
      {
        port: INTERNAL_PORT,
      },
      async () => {
        logger.info(
          `🚀 Server ready at http://0.0.0.0:${INTERNAL_PORT} (internal)`
        );
      }
    );
  }

  // initialize db
  await seed();
  return [externalServer, internalServer, apolloServer];
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
    case RunProfile.INT_TEST:
      return 'int-test';
  }
}

export function getApolloServerInstance() {
  return apolloServer;
}

export function shouldExposeInternalEndpoints(): boolean {
  return (
    process.env.INTERNAL_ENDPOINTS === '1' ||
    process.env.INTERNAL_ENDPOINTS === 'true'
  );
}

export function shouldExposeExternalEndpoints(): boolean {
  return (
    process.env.EXTERNAL_ENDPOINTS === '1' ||
    process.env.EXTERNAL_ENDPOINTS === 'true'
  );
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
