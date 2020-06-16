import{ ApolloServer } from 'apollo-server-express';
import { initializeDB } from './initdb';
import { fileLoader, mergeTypes } from 'merge-graphql-schemas';
import { merge } from 'lodash';
import { authorize } from '@src/middlewares/authorization';

const GQL_PORT = 9501;

const requestContext = async ({ req }) => {
  const ctx = {
    req: req,
  };
  return ctx;
};

export async function start() {
    console.log("In start method")
    const schemaDir = __dirname + '/' + '../../src/graphql/*.graphql';
    const typesArray = fileLoader(schemaDir, { recursive: true });
    const typeDefs1 = mergeTypes(typesArray, { all: true });
    const resolversDir = __dirname + '/' + './resolvers/';
    let resolversFiles = fileLoader(resolversDir, {
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

    await initializeDB();


    const express = require("express");
    const app = express();
    app.use(authorize);

    server.applyMiddleware({ app, path: '/' });
    app.listen({
      port: 9501
    },
    async () => {
        console.log(`🚀 Server ready at http://localhost:${GQL_PORT}}`);
      }
    );
}
