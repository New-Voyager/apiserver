require('source-map-support').install();
require('module-alias/register');
require('reflect-metadata');
import {start} from '../src/server';

// testSetup.ts
module.exports = async () => {
  const [app, server, apolloServer] = await start(false);
  setApolloServer(apolloServer);
};

export let apolloServer: any;
export function setApolloServer(server: any) {
  apolloServer = server;
}

export function getApolloServer() {
  return apolloServer;
}

