// import {createConnection} from "typeorm";
// import {start} from '../../src/server';
// import {Player} from "../../src/entity/player";
// import {Club, ClubMember} from "../../src/entity/club";
// import {PokerGame, PokerGamePlayers, PokerHand} from "../../src/entity/game";
import {default as ApolloClient, gql} from 'apollo-boost';
const fetch=require('node-fetch');
const PORT_NUMBER = 9501;

/*
async function sqlliteDBConnection() {
  process.env.NODE_ENV = 'test';
  process.env.DB_TEST="sqllite"
  const connection = await createConnection({
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
  return connection;
}

export async function pgConnection() {
  const connection = await createConnection({
    type: "postgres",
    host: "10.2.4.4",
    port: 5436,
    username: "game",
    password: "game",
    database: "game",
    entities: [
      Player,
      Club,
      ClubMember,
      PokerGame,
      PokerHand,
      PokerGamePlayers
    ],
    synchronize: true,
    logging: false
  });
  return connection;
}


export class TestServer {
  connection: any;
  app: any;
  httpServer: any;
  alreadyStarted: boolean;
  public async start() {
    if(this.alreadyStarted) {
      return;
    }
    this.alreadyStarted = true;
    //this.connection = await sqlliteDBConnection();
    this.connection = await pgConnection();
    [this.app, this.httpServer] = await start(this.connection);
    //[this.app, this.httpServer] = await start();
    console.log("Server is started");
  }

  public async stop() {
    await this.connection.close();
    await this.httpServer.close(() => {
    });
  }
}

*/

export function getClient(token?: string, test?: string): any {
    return new ApolloClient({
    fetch: fetch,
    uri: `http://localhost:${PORT_NUMBER}/`,
    request: (operation) => {
      console.log(`Auth header: ${token}`);
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
    mutation: resetDB,
  });
}

//export const server = new TestServer();