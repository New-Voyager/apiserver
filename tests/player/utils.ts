import { gql } from 'apollo-server-express';
import { getClient } from '../utils/utils';

const allPlayers = gql`
  query {
    allPlayers {
      name
      playerId
    }
  }
`

const encryptionKey = gql`
  query {
    encryptionKey 
  }
`

export const getEncryptionKey = async ({ownerId}) => {
  const variables = {};
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: encryptionKey,
  });
  return resp.data;
};

export const getAllPlayers = async ({ownerId}) => {
  const variables = {};
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: allPlayers,
  });
  return resp.data;
};