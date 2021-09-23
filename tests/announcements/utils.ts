import {gql} from 'apollo-server-express';
import {getClient} from '../utils/utils';

const clubAnnouncementsQuery = gql`
  query($clubCode: String!) {
    announcements: clubAnnouncements(clubCode: $clubCode) {
      text
      createdAt
      expiresAt
    }
  }
`;
const systemAnnouncementsQuery = gql`
  query {
    announcements: systemAnnouncements {
      text
      createdAt
      expiresAt
    }
  }
`;

const addClubAnnouncementMutation = gql`
  mutation($clubCode: String!, $text: String!, $expiresAt: DateTime!) {
    addClubAnnouncement(clubCode: $clubCode, text: $text, expiresAt: $expiresAt)
  }
`;

const addSystemAnnouncementMutation = gql`
  mutation($text: String!, $expiresAt: DateTime!) {
    addSystemAnnouncement(text: $text, expiresAt: $expiresAt)
  }
`;

export const getSystemAnnouncements = async ({ownerId}) => {
  const variables = {};
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: systemAnnouncementsQuery,
  });
  return resp.data;
};

export const getClubAnnouncements = async ({clubCode, ownerId}) => {
  const variables = {
    clubCode,
  };
  const client = getClient(ownerId);
  const resp = await client.query({
    variables: variables,
    query: clubAnnouncementsQuery,
  });
  return resp.data;
};

export const addClubAnnouncement = async ({
  clubCode,
  text,
  expiresAt,
  ownerId,
}) => {
  const variables = {
    clubCode,
    text,
    expiresAt,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: addClubAnnouncementMutation,
  });
  return resp.data;
};

export const addSystemAnnouncement = async ({text, expiresAt, ownerId}) => {
  const variables = {
    text,
    expiresAt,
  };
  const client = getClient(ownerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: addSystemAnnouncementMutation,
  });
  return resp.data;
};
