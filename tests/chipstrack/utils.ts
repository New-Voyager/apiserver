import {gql} from 'apollo-server-express';
import {getClient} from '../utils/utils';

const rakeCollectedQuery = gql`
  query($gameCode: String!) {
    rakeCollected(gameCode: $gameCode)
  }
`;

const playerBalanceQuery = gql`
  query($clubCode: String!, $playerId: String) {
    playerBalance(clubCode: $clubCode, playerId: $playerId) {
      playerId
    }
  }
`;

const clubBalanceQuery = gql`
  query($clubCode: String!) {
    clubBalance(clubCode: $clubCode) {
      balance
      updatedAt
    }
  }
`;

export const getRakeCollected = async ({clubCode, ownerId, gameCode}) => {
  const variables = {
    clubCode,
    gameCode,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: rakeCollectedQuery,
  });
  return resp.data;
};

export const getPlayerBalance = async ({clubCode, ownerId, playerId}) => {
  const variables = {
    clubCode,
    playerId,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: playerBalanceQuery,
  });
  return resp.data;
};

export const getClubBalance = async ({clubCode, ownerId}) => {
  const variables = {
    clubCode,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: clubBalanceQuery,
  });
  return resp.data;
};
