import {gql} from 'apollo-server-express';
import {getClient} from '../utils/utils';

const gameHistoryQuery = gql`
  query($clubCode: String) {
    gameHistory(clubCode: $clubCode) {
      title
    }
  }
`;

const completedGameQuery = gql`
  query($gameCode: String!) {
    completedGame(gameCode: $gameCode) {
      title
    }
  }
`;

export const completedGame = async ({ownerId, gameCode}) => {
  const variables = {
    gameCode,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: completedGameQuery,
  });
  return resp.data;
};

export const gameHistory = async ({ownerId, clubCode}) => {
  const variables = {
    clubCode,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: gameHistoryQuery,
  });
  return resp.data;
};
