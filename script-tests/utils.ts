import {default as ApolloClient, gql} from 'apollo-boost';
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
            Authorization: `jwt ${token}`,
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
  const resetDB = gql`
    mutation {
      resetDB
    }
  `;
  const resp = await getClient().mutate({
    mutation: resetDB,
  });
}
