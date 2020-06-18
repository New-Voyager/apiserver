import {ApolloServer} from 'apollo-server-express';
import {fileLoader, mergeTypes} from 'merge-graphql-schemas';
import {merge} from 'lodash';
import {authorize} from '@src/middlewares/authorization';
import {createConnection, getConnectionOptions} from 'typeorm';

const GQL_PORT = 9501;

const requestContext = async ({req}) => {
  const ctx = {
    req: req,
  };
  return ctx;
};

let app: any = null;

export async function start(dbConnection?: any): Promise<[any, any]> {
  console.log('In start method');
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
    console.log('Running in dev/prod mode');
    const options = await getConnectionOptions('default');
    await createConnection(options);
  } else {
    console.log('Running in TEST mode');
    process.env.DB_USED = 'sqllite';
    const options = await getConnectionOptions('test');
    await createConnection({...options, name: 'default'});
  }

  const express = require('express');
  app = express();
  app.use(authorize);

  server.applyMiddleware({app, path: '/'});

  const httpServer = app.listen(
    {
      port: 9501,
    },
    async () => {
      console.log(`🚀 Server ready at http://0.0.0.0:${GQL_PORT}}`);
    }
  );
  return [app, httpServer];
}
