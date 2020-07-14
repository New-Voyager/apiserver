import {resetDatabase, getClient} from './utils';
import {gql} from 'apollo-boost';

export const createPlayerQuery = gql`
  mutation($input: PlayerCreateInput!) {
    playerId: createPlayer(player: $input)
  }
`;
export const createClubQuery = gql`
  mutation($input: ClubCreateInput!) {
    clubId: createClub(club: $input)
  }
`;
export const updateClubQuery = gql`
  mutation($clubId: String!, $input: ClubUpdateInput!) {
    success: updateClub(clubId: $clubId, club: $input)
  }
`;
export const joinClubQuery = gql`
  mutation($clubId: String!) {
    status: joinClub(clubId: $clubId)
  }
`;
export const approveClubQuery = gql`
  mutation($clubId: String!, $playerUuid: String!) {
    status: approveMember(clubId: $clubId, playerUuid: $playerUuid)
  }
`;
export const kickedClubQuery = gql`
  mutation($clubId: String!, $playerUuid: String!) {
    status: kickMember(clubId: $clubId, playerUuid: $playerUuid)
  }
`;
export const leaveClubQuery = gql`
  mutation($clubId: String!) {
    status: leaveClub(clubId: $clubId)
  }
`;

export const queryClubMembers = gql`
  query($clubId: String!) {
    members: clubMembers(clubId: $clubId) {
      name
      joinedDate
      status
      lastGamePlayedDate
      imageId
      isOwner
      isManager
      playerId
    }
  }
`;

export const rejectClubQuery = gql`
  mutation($clubId: String!, $playerUuid: String!) {
    status: rejectMember(clubId: $clubId, playerUuid: $playerUuid)
  }
`;

const myClubsQuery = gql`
  query {
    clubs: myClubs {
      name
      private
      clubId
    }
  }
`;

export const clubByIdQuery = gql`
  query($clubId: String!) {
    club: clubById(clubId: $clubId) {
      id
    }
  }
`;

/**
 * Creates a club and returns clubId and owner id
 */
export async function createClub(
  owner?: string,
  club?: string
): Promise<[string, string]> {
  if (!owner) {
    owner = 'owner';
  }

  if (!club) {
    club = 'bbc';
  }
  const ownerInput = {
    input: {
      name: owner,
      deviceId: 'abc123',
    },
  };
  const client = getClient();
  let resp = await client.mutate({
    variables: ownerInput,
    mutation: createPlayerQuery,
  });
  const ownerId = resp.data.playerId;
  const clubInput = {
    input: {
      name: club,
      description: 'poker players gather',
    },
  };
  const ownerClient = getClient(ownerId);
  // use the player in the auth header
  resp = await ownerClient.mutate({
    variables: clubInput,
    mutation: createClubQuery,
  });
  const clubId = resp.data.clubId;

  return [clubId, ownerId];
}

export async function createPlayer(name: string, deviceId: string) {
  const variables = {
    input: {
      name: name,
      deviceId: deviceId,
    },
  };
  const client = getClient();
  const resp = await client.mutate({
    variables: variables,
    mutation: createPlayerQuery,
  });
  return resp.data.playerId;
}

export async function getClubById(clubId: string): Promise<number> {
  const clubClient = getClient(clubId);
  const resp = await clubClient.query({
    variables: {clubId: clubId},
    query: clubByIdQuery,
  });
  return resp.data.club.id;
}

export async function playerJoinsClub(clubId: string, playerId: string) {
  const playerClient = getClient(playerId);
  const variables = {
    clubId: clubId,
  };

  await playerClient.mutate({
    variables: variables,
    mutation: joinClubQuery,
  });
}

export async function getClubMembers(
  playerId: string,
  clubId: string
): Promise<Array<any>> {
  const playerClient = getClient(playerId);
  const variables = {
    clubId: clubId,
  };

  const resp = await playerClient.query({
    variables: variables,
    query: queryClubMembers,
  });

  return resp.data.members;
}

export async function approvePlayer(
  clubId: string,
  ownerId: string,
  playerId: string
) {
  const ownerClient = getClient(ownerId);
  const variables = {
    clubId: clubId,
    playerUuid: playerId,
  };
  const resp = await ownerClient.mutate({
    variables: variables,
    mutation: approveClubQuery,
  });
  expect(resp.data.status).toBe('ACTIVE');
}

export async function getMyClubs(playerId: string): Promise<Array<any>> {
  const playerClient = getClient(playerId);
  const resp = await playerClient.query({
    query: myClubsQuery,
  });

  return resp.data.clubs;
}
