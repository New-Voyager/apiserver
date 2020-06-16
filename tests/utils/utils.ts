import {createConnection, getConnection} from "typeorm";
import {start} from '../../src/server';
import {Player} from "../../src/entity/player";
import {Club, ClubMember} from "../../src/entity/club";
import {PokerGame, PokerGamePlayers, PokerHand} from "../../src/entity/game";
import { Server } from "http";
import {default as ApolloClient, gql} from 'apollo-boost';
import fetch from 'node-fetch';
process.env.NODE_ENV = 'test';
const PORT_NUMBER = 9501;

async function sqlliteDBConnection() {
    return createConnection({
      type: "sqlite",
      database: ":memory:",
      dropSchema: true,
      entities: [
        Player,
        Club,
        ClubMember,
        PokerGame,
        PokerHand,
        PokerGamePlayers
      ],
      synchronize: true,
      logging: true
  });
}



export class TestServer {
  connection: any;
  app: any;
  httpServer: any;
  public async start() {
    this.connection = await sqlliteDBConnection();
    [this.app, this.httpServer] = await start(this.connection);
    console.log("Server is started");
  }

  public async stop() {
    await this.connection.close();
    await this.httpServer.close(() => {
    });
  }
}


export function getClient(token: string): any {
    return new ApolloClient({
    fetch: fetch,
    uri: `http://localhost:${PORT_NUMBER}/`,
    request: (operation) => {
      if(token) {
        operation.setContext({
          headers: {
            "Authorization": `Bearer ${token}`
          }
        })
      }
    },
    onError: (e) => { console.log(e) },
  });
}

export async function resetDatabase() {
  const client = getClient("TEST_USER");
  const resetDB = gql`mutation { resetDB }`;
  await client.mutate({
    mutation: resetDB
  });
}
