import {gql} from 'apollo-server-express';
import {getClient} from '../utils/utils';

const exitGameMutation = gql`
  mutation($gameCode: String!) {
    exitGame(gameCode: $gameCode)
  }
`;

const observeGameMutation = gql`
  mutation($gameCode: String!) {
    observeGame(gameCode: $gameCode)
  }
`;

const observersQuery = gql`
  query($gameCode: String!) {
    observers(gameCode: $gameCode) {
      id
    }
  }
`;

export const exitGame = async ({ownerId, gameCode}) => {
  const variables = {
    gameCode,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: exitGameMutation,
  });
  return resp.data;
};

export const observeGame = async ({ownerId, gameCode}) => {
  const variables = {
    gameCode,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: observeGameMutation,
  });
  return resp.data;
};

export const observers = async ({ownerId, gameCode}) => {
  const variables = {
    gameCode,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: observersQuery,
  });
  return resp.data;
};
