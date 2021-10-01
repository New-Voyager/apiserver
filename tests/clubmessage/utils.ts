import {gql} from 'apollo-server-express';
import {getClient} from '../utils/utils';

const messagesFromMemberQuery = gql`
  query($clubCode: String, $playerId: String!) {
    messagesFromMember(clubCode: $clubCode, playerId: $playerId) {
      memberId
    }
  }
`;

const messagesFromHostQuery = gql`
  query($clubCode: String!) {
    messagesFromHost(clubCode: $clubCode) {
      memberId
    }
  }
`;

const hostMessageSummaryQuery = gql`
  query($clubCode: String!) {
    hostMessageSummary(clubCode: $clubCode) {
      memberId
    }
  }
`;

const markMessagesReadMutation = gql`
  mutation($clubCode: String!) {
    markMessagesRead(clubCode: $clubCode)
  }
`;

const sendMessageToHostMutation = gql`
  mutation($clubCode: String!, $text: String!) {
    sendMessageToHost(clubCode: $clubCode, text: $text) {
      id
    }
  }
`;

const sendMessageToMemberMutation = gql`
  mutation($clubCode: String!, $playerId: String!, $text: String!) {
    sendMessageToMember(clubCode: $clubCode, playerId: $playerId, text: $text) {
      id
    }
  }
`;

export const getMessagesFromMember = async ({ownerId, clubCode, playerId}) => {
  const variables = {
    clubCode,
    playerId,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: messagesFromMemberQuery,
  });
  return resp.data;
};

export const getMessagesFromHost = async ({ownerId, clubCode}) => {
  const variables = {
    clubCode,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: messagesFromHostQuery,
  });
  return resp.data;
};

export const getHostMessageSummary = async ({ownerId, clubCode}) => {
  const variables = {
    clubCode,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: hostMessageSummaryQuery,
  });
  return resp.data;
};

export const markMessagesRead = async ({ownerId, clubCode}) => {
  const variables = {
    clubCode,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: markMessagesReadMutation,
  });
  return resp.data;
};

export const sendMessageToHost = async ({ownerId, clubCode, text}) => {
  const variables = {
    clubCode,
    text,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: sendMessageToHostMutation,
  });
  return resp.data;
};

export const sendMessageToMember = async ({
  ownerId,
  clubCode,
  playerId,
  text,
}) => {
  const variables = {
    clubCode,
    playerId,
    text,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: sendMessageToMemberMutation,
  });
  return resp.data;
};
