import {default as ApolloClient, gql} from 'apollo-boost';
import axios from 'axios';
import { getApolloServer } from '../testSetup';
const fetch = require('node-fetch');
export const PORT_NUMBER = 9501;

export function getClient(token?: string, test?: string): any {
  return new ApolloClient({
    fetch: fetch,
    uri: `http://localhost:${PORT_NUMBER}/graphql`,
    request: operation => {
      if (token) {
        operation.setContext({
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    },
    onError: e => {
      console.log(e);
    },
  });
}

export async function resetDatabase() {
  const client = getClient('TEST_USER');
  const resetDB = gql`
    mutation {
      resetDB
    }
  `;
  const resp = await client.mutate({
    mutation: resetDB,
  });
  console.log(`Reset DB: ${resp.resetDB}`);
}

export async function moveToNextHand(
  gameId: number,
  gameCode: string,
  handNum: number
) {
  const url = `http://localhost:${PORT_NUMBER}/internal/move-to-next-hand/game_num/${gameCode}/hand_num/${handNum}`;
  try {
    await axios.post(url);
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export async function getNextHandInfo(gameCode: string) {
  const url = `http://localhost:${PORT_NUMBER}/internal/next-hand-info/game_num/${gameCode}`;
  try {
    const resp = await axios.get(url);
    return resp.data;
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export async function signup(name: string, playerId: string): Promise<any> {
  const url = `http://localhost:${PORT_NUMBER}/auth/signup`;
  try {
    const payload = {
      'screen-name': name,
      'device-id': playerId,
    };
    const resp = await axios.post(url, payload);
    return resp.data;
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export async function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export async function getClubs(playerId: string) {
  console.log("In getClubs");
  await resetDatabase();
  
  const client = getClient(playerId);
  
  const hello = gql`
          query {
            hello
          }
        `;
  const resp = await client.query({
    query: hello,
  });
  console.log(JSON.stringify(resp));
}
