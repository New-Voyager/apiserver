import {gql} from 'apollo-server-express';
import {getClient} from '../utils/utils';

const chatTextsQuery = gql`
  query($clubCode: String) {
    chatTexts(clubCode: $clubCode)
  }
`;

const addPlayerChatTextMutation = gql`
  mutation($text: String!) {
    addPlayerChatText(text: $text)
  }
`;

const removePlayerChatTextMutation = gql`
  mutation($text: String!) {
    removePlayerChatText(text: $text)
  }
`;

const removeClubChatTextMutation = gql`
  mutation($clubCode: String!, $text: String!) {
    removeClubChatText(clubCode: $clubCode, text: $text)
  }
`;

const addClubChatTextMutation = gql`
  mutation($clubCode: String!, $text: String!) {
    addClubChatText(clubCode: $clubCode, text: $text)
  }
`;

export const getChatTexts = async ({clubCode, ownerId}) => {
  const variables = {
    clubCode,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: chatTextsQuery,
  });
  return resp.data;
};

export const addPlayerChatText = async ({text, ownerId}) => {
  const variables = {
    text,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: addPlayerChatTextMutation,
  });
  return resp.data;
};

export const removePlayerChatText = async ({text, ownerId}) => {
  const variables = {
    text,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: removePlayerChatTextMutation,
  });
  return resp.data;
};

export const addClubChatText = async ({text, clubCode, ownerId}) => {
  const variables = {
    text,
    clubCode,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: addClubChatTextMutation,
  });
  return resp.data;
};

export const removeClubChatText = async ({text, clubCode, ownerId}) => {
  const variables = {
    text,
    clubCode,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: removeClubChatTextMutation,
  });
  return resp.data;
};
