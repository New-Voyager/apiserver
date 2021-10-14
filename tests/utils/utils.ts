import {default as ApolloClient} from 'apollo-boost';
import axios from 'axios';
import {execute, gql, HttpLink, toPromise} from 'apollo-boost';
import {start} from '../../src/server';
import fetch from 'node-fetch'
export const EXTERNAL_PORT = 9501;
export const INTERNAL_PORT = 9502;

export function getClient(token?: string): any {
  return new ApolloClient({
    fetch: fetch,
    uri: `http://localhost:${EXTERNAL_PORT}/graphql`,
    request: operation => {
      if (token) {
        operation.setContext({
          userIp: 1,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    },
  });
}

export async function resetDatabase() {
  const client = getClient('TEST_USER',);
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

export async function runLivenessProbe() {
  const url = `http://localhost:${INTERNAL_PORT}/internal/alive`;
  try {
    const start = Date.now()
    const resp = await axios.get(url, {timeout: 3000});
    const end = Date.now()
    console.info(`Liveness probe took ${end - start} ms`);
    if (resp.status != 200) {
      throw new Error(`Received http status ${resp.status}`);
    }
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export async function moveToNextHand(
  gameId: number,
  gameCode: string,
  handNum: number
) {
  const url = `http://localhost:${INTERNAL_PORT}/internal/move-to-next-hand/game_num/${gameCode}/hand_num/${handNum}`;
  try {
    await axios.post(url);
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export async function anyPendingUpdates(
  gameId: number,
) {
  const url = `http://localhost:${INTERNAL_PORT}/internal/any-pending-updates/gameId/${gameId}`;
  try {
    const resp = await axios.get(url);
    return resp.data['pendingUpdates'];
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export async function processPendingUpdates(
  gameId: number,
) {
  const url = `http://localhost:${INTERNAL_PORT}/internal/process-pending-updates/gameId/${gameId}`;
  try {
    await axios.post(url);
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export async function getNextHandInfo(gameCode: string) {
  const url = `http://localhost:${INTERNAL_PORT}/internal/next-hand-info/game_num/${gameCode}`;
  try {
    const resp = await axios.get(url);
    return resp.data;
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export async function signup(name: string, playerId: string): Promise<any> {
  const url = `http://localhost:${EXTERNAL_PORT}/auth/signup`;
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
  console.log('In getClubs');
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

export const startGqlServer = async () => {
  const [externalServer, internalServer, apollo]= await start(false, {intTest: true});

  const link = new HttpLink({
    uri: `http://localhost:${EXTERNAL_PORT}/graphql`,
    fetch,
  });

  const executeOperation = ({query, variables = {}}) =>
    execute(link, {query, variables});

  return {
    link,
    stop: () => {
      externalServer.close();
      internalServer.close();
    },
    graphql: executeOperation,
  };
};
