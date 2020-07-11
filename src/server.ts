import {ApolloServer} from 'apollo-server-express';
import {fileLoader, mergeTypes} from 'merge-graphql-schemas';
import {merge} from 'lodash';
import {authorize} from '@src/middlewares/authorization';
import {createConnection, getConnectionOptions} from 'typeorm';
import {GameServerAPI} from './internal/gameserver';
import {HandServerAPI} from './internal/hand';
const bodyParser = require('body-parser');
const GQL_PORT = 9501;
import {getLogger} from '@src/utils/log';
const logger = getLogger("server");

const requestContext = async ({req}) => {
  const ctx = {
    req: req,
  };
  return ctx;
};

let app: any = null;

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

  if (process.env.NODE_ENV != 'test') {
    logger.debug('Running in dev/prod mode');
    const options = await getConnectionOptions('default');
    await createConnection(options);
  } else {
    logger.debug('Running in TEST mode');
    process.env.DB_USED = 'sqllite';
    const options = await getConnectionOptions('test');
    await createConnection({...options, name: 'default'});
  }

  const express = require('express');
  app = express();
  app.use(authorize);
  app.use(bodyParser.json());
  server.applyMiddleware({app});

  const httpServer = app.listen(
    {
      port: 9501,
    },
    async () => {
      logger.error(`🚀 Server ready at http://0.0.0.0:${GQL_PORT}/graphql}`);
    }
  );

  addInternalRoutes(app);
  return [app, httpServer];
}

function addInternalRoutes(app: any) {
  app.post('/internal/register-game-server', GameServerAPI.registerGameServer);
  app.post('/internal/update-game-server', GameServerAPI.updateGameServer);
  app.get('/internal/game-servers', GameServerAPI.getGameServers);
  app.post('/internal/save-hand', HandServerAPI.saveHand);
  app.get(
    '/internal/get-game-server/club_id/:clubId/game_num/:gameNum',
    GameServerAPI.getSpecificGameServer
  );
}
