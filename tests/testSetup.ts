require('source-map-support').install();
require('module-alias/register');
require('reflect-metadata');
import {getApolloServerInstance, start} from '../src/server';

// testSetup.ts
module.exports = async () => {
  console.log('Launching GQL server');
  const [app, server, apolloServer] = await start(false);
  const apolloServerInstance = getApolloServerInstance();
  setApolloServer(apolloServerInstance);
  console.log('GQL server is launched');
};

export let apolloServer: any;
export function setApolloServer(server: any) {
  apolloServer = server;
}

export function getApolloServer() {
  return apolloServer;
}

