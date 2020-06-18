import {default as ApolloClient, gql} from 'apollo-boost';
const fetch = require('node-fetch');
const PORT_NUMBER = 9501;

export function getClient(token?: string, test?: string): any {
  return new ApolloClient({
    fetch: fetch,
    uri: `http://localhost:${PORT_NUMBER}/`,
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
  await client.mutate({
    mutation: resetDB,
  });
}

//export const server = new TestServer();
