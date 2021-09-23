import {gql} from 'apollo-server-express';
import {getClient} from '../utils/utils';

const playerTransactionsQuery = gql`
  query($clubCode: String!, $playerId: String!) {
    transactions: playerTransactions(clubCode: $clubCode, playerId: $playerId) {
      playerId
      otherPlayerId
      type
      subType
      amount
      notes
      updatedDate
    }
  }
`;

const clubTransactionsQuery = gql`
  query($clubCode: String!) {
    transactions: clubTransactions(clubCode: $clubCode) {
      playerId
      type
      subType
      amount
      notes
      updatedDate
    }
  }
`;

const updatePlayerBalanceMutation = gql`
  mutation(
    $clubCode: String!
    $playerId: String!
    $amount: Float!
    $notes: String!
  ) {
    updatePlayerBalance(
      clubCode: $clubCode
      playerId: $playerId
      amount: $amount
      notes: $notes
    )
  }
`;

const updateClubBalanceMutation = gql`
  mutation($clubCode: String!, $amount: Float!, $notes: String!) {
    updateClubBalance(clubCode: $clubCode, amount: $amount, notes: $notes)
  }
`;

const withdrawTokensFromClubMutation = gql`
  mutation(
    $clubCode: String!
    $amount: Float!
    $notes: String!
    $subType: TransactionSubType!
  ) {
    withdrawTokensFromClub(
      clubCode: $clubCode
      subType: $subType
      amount: $amount
      notes: $notes
    )
  }
`;

const addTokensToClubMutation = gql`
  mutation(
    $clubCode: String!
    $subType: TransactionSubType!
    $amount: Float!
    $notes: String!
  ) {
    addTokensToClub(
      clubCode: $clubCode
      subType: $subType
      amount: $amount
      notes: $notes
    )
  }
`;

const withdrawTokensFromPlayerMutation = gql`
  mutation(
    $clubCode: String!
    $playerId: String!
    $subType: TransactionSubType!
    $amount: Float!
    $notes: String!
  ) {
    withdrawTokensFromPlayer(
      clubCode: $clubCode
      subType: $subType
      playerId: $playerId
      amount: $amount
      notes: $notes
    )
  }
`;

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

export const getPlayerTransactions = async ({clubCode, ownerId, playerId}) => {
  const variables = {
    clubCode,
    playerId,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: playerTransactionsQuery,
  });
  return resp.data;
};

export const getClubTransactions = async ({clubCode, ownerId}) => {
  const variables = {
    clubCode,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: clubTransactionsQuery,
  });
  return resp.data;
};

export const updatePlayerBalance = async ({
  clubCode,
  amount,
  notes,
  ownerId,
  playerId,
}) => {
  const variables = {
    clubCode,
    playerId,
    amount,
    notes,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: updatePlayerBalanceMutation,
  });
  return resp.data;
};

export const updateClubBalance = async ({clubCode, amount, notes, ownerId}) => {
  const variables = {
    clubCode,
    amount,
    notes,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: updateClubBalanceMutation,
  });
  return resp.data;
};

export const withdrawTokensFromClub = async ({
  clubCode,
  subType,
  amount,
  notes,
  ownerId,
}) => {
  const variables = {
    clubCode,
    subType,
    amount,
    notes,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: withdrawTokensFromClubMutation,
  });
  return resp.data;
};

export const withdrawTokensFromPlayer = async ({
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
    mutation: withdrawTokensFromPlayerMutation,
  });
  return resp.data;
};

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

export const addTokensToClub = async ({
  clubCode,
  subType,
  amount,
  notes,
  ownerId,
}) => {
  const variables = {
    clubCode,
    subType,
    amount,
    notes,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: addTokensToClubMutation,
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
