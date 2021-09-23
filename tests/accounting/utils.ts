import {gql} from 'apollo-server-express';
import {getClient} from '../utils/utils';

const addTokensToPlayerMutation = gql`
  mutation(
    $clubCode: String!
    $playerId: String!
    $subType: TransactionSubType!
    $amount: Float!
    $notes: String!
  ) {
    addTokensToPlayer(
      clubCode: $clubCode
      subType: $subType
      playerId: $playerId
      amount: $amount
      notes: $notes
    )
  }
`;

const settlePlayerToPlayerMutation = gql`
  mutation(
    $clubCode: String!
    $fromPlayerId: String!
    $toPlayerId: String!
    $amount: Float!
    $notes: String!
  ) {
    settlePlayerToPlayer(
      clubCode: $clubCode
      fromPlayerId: $fromPlayerId
      toPlayerId: $toPlayerId
      amount: $amount
      notes: $notes
    )
  }
`;

export const addTokensToPlayer = async ({
  clubCode,
  subType,
  playerId,
  amount,
  notes,
  ownerId,
}) => {
  const variables = {
    clubCode,
    subType,
    playerId,
    amount,
    notes,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: addTokensToPlayerMutation,
  });
  return resp.data;
};

export const settlePlayerToPlayer = async ({
  clubCode,
  fromPlayerId,
  toPlayerId,
  amount,
  notes,
  ownerId,
}) => {
  const variables = {
    clubCode,
    fromPlayerId,
    toPlayerId,
    amount,
    notes,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: settlePlayerToPlayerMutation,
  });
  return resp.data;
};
