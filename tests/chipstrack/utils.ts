import {gql} from 'apollo-server-express';
import {getClient} from '../utils/utils';

const rakeCollectedQuery = gql`
  query($gameCode: String!) {
    rakeCollected(gameCode: $gameCode)
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
