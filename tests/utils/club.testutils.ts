import {resetDatabase, getClient} from './utils';
import {gql} from 'apollo-boost';
import {ClubMember} from '../../src/entity/club';

export const createPlayerQuery = gql`
  mutation($input: PlayerCreateInput!) {
    playerId: createPlayer(player: $input)
  }
`;
export const createClubQuery = gql`
  mutation($input: ClubCreateInput!) {
    clubCode: createClub(club: $input)
  }
`;
export const updateClubQuery = gql`
  mutation($clubCode: String!, $input: ClubUpdateInput!) {
    success: updateClub(clubCode: $clubCode, club: $input)
  }
`;
export const joinClubQuery = gql`
  mutation($clubCode: String!) {
    status: joinClub(clubCode: $clubCode)
  }
`;
export const approveClubQuery = gql`
  mutation($clubCode: String!, $playerUuid: String!) {
    status: approveMember(clubCode: $clubCode, playerUuid: $playerUuid)
  }
`;
export const kickedClubQuery = gql`
  mutation($clubCode: String!, $playerUuid: String!) {
    status: kickMember(clubCode: $clubCode, playerUuid: $playerUuid)
  }
`;
export const leaveClubQuery = gql`
  mutation($clubCode: String!) {
    status: leaveClub(clubCode: $clubCode)
  }
`;

export const queryClubMembers = gql`
  query($clubCode: String!) {
    members: clubMembers(clubCode: $clubCode) {
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

export const queryMemberStatus = gql`
  query($clubCode: String!) {
    status: clubMemberStatus(clubCode: $clubCode) {
      id
      status
      isManager
      isOwner
      contactInfo
      ownerNotes
      lastGamePlayedDate
      joinedDate
      leftDate
      viewAllowed
      playAllowed
      createdAt
      updatedAt
    }
  }
`;

export const rejectClubQuery = gql`
  mutation($clubCode: String!, $playerUuid: String!) {
    status: rejectMember(clubCode: $clubCode, playerUuid: $playerUuid)
  }
`;

const myClubsQuery = gql`
  query {
    clubs: myClubs {
      name
      private
      clubCode
    }
  }
`;

export const clubByIdQuery = gql`
  query($clubCode: String!) {
    club: clubById(clubCode: $clubCode) {
      id
    }
  }
`;

export const updateClubMemberQuery = gql`
  mutation(
    $clubCode: String!
    $playerUuid: String!
    $update: ClubMemberUpdateInput!
  ) {
    status: updateClubMember(
      clubCode: $clubCode
      playerUuid: $playerUuid
      update: $update
    )
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
  const clubCode = resp.data.clubCode;

  return [clubCode, ownerId];
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

export async function getClubById(clubCode: string): Promise<number> {
  const clubClient = getClient(clubCode);
  const resp = await clubClient.query({
    variables: {clubCode: clubCode},
    query: clubByIdQuery,
  });
  return resp.data.club.id;
}

export async function playerJoinsClub(clubCode: string, playerId: string) {
  const playerClient = getClient(playerId);
  const variables = {
    clubCode: clubCode,
  };

  await playerClient.mutate({
    variables: variables,
    mutation: joinClubQuery,
  });
}

export async function getClubMembers(
  playerId: string,
  clubCode: string
): Promise<Array<any>> {
  const playerClient = getClient(playerId);
  const variables = {
    clubCode: clubCode,
  };

  const resp = await playerClient.query({
    variables: variables,
    query: queryClubMembers,
  });

  return resp.data.members;
}

export async function getClubMember(
  playerId: string,
  clubCode: string
): Promise<ClubMember> {
  const playerClient = getClient(playerId);
  const variables = {
    clubCode: clubCode,
  };

  const resp = await playerClient.query({
    variables: variables,
    query: queryMemberStatus,
  });

  return resp.data.status;
}

export async function approvePlayer(
  clubCode: string,
  ownerId: string,
  playerId: string
) {
  const ownerClient = getClient(ownerId);
  const variables = {
    clubCode: clubCode,
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

export async function updateClubMember(
  clubCode: string,
  ownerId: string,
  playerId: string,
  updatedata: any
) {
  const ownerClient = getClient(ownerId);
  const variables = {
    clubCode: clubCode,
    playerUuid: playerId,
    update: updatedata,
  };
  const resp = await ownerClient.mutate({
    variables: variables,
    mutation: updateClubMemberQuery,
  });
  return resp.data;
}
