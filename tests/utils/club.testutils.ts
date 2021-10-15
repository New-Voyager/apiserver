import {getClient, signup} from './utils';
import {gql} from 'apollo-boost';
import {ClubMember} from '../../src/entity/player/club';

export const leaderboardQuery = gql`
  query($clubCode: String!) {
    status: clubLeaderBoard(clubCode: $clubCode) {
      playerName
      playerId
      playerUuid
      gamesPlayed
      handsPlayed
      buyin
      profit
      rakePaid
    }
  }
`;

export const sendClubFcmMessageQuery = gql`
  mutation($clubCode: String!, $message: Json!) {
    success: sendClubFcmMessage(clubCode: $clubCode, message: $message)
  }
`;

export const deleteClubQuery = gql`
  mutation($clubCode: String!) {
    success: deleteClub(clubCode: $clubCode)
  }
`;

export const createPlayerQuery = gql`
  mutation($input: PlayerCreateInput!) {
    playerId: createPlayer(player: $input)
  }
`;

export const changeDisplayNameQuery = gql`
  mutation($name: String!) {
    success: changeDisplayName(name: $name)
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
    status: clubInfo(clubCode: $clubCode) {
      status
      isManager
      isOwner
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
  host
  clubCode
  clubStatus
  picUrl
  memberCount
  imageId
  isOwner
  private
  memberStatus
  balance
  pendingMemberCount
  unreadMessageCount
  memberUnreadMessageCount
  hostUnreadMessageCount
  liveGameCount
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
  const client = getClient();
  // let resp = await client.mutate({
  //   variables: ownerInput,
  //   mutation: createPlayerQuery,
  // });
  let resp = await signup(owner, 'abc123');
  const ownerId = resp['uuid'];
  const clubInput = {
    input: {
      name: club,
      description: 'poker players gather',
    },
  };
  const ownerClient = getClient(ownerId);

  // get my clubs
  const myClubs = await getMyClubs(ownerId);
  console.log(`My clubs: ${JSON.stringify(myClubs)}`);

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

export async function changeDisplayName(playerId: string, name: string) {
  const variables = {
    name: name,
  };
  const client = getClient(playerId);
  const resp = await client.mutate({
    variables: variables,
    mutation: changeDisplayNameQuery,
  });
  return resp.data;
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

/**
 * Creates a club and returns clubId and owner id
 */
export async function createClub2(
  graphql: any,
  owner?: string,
  club?: string
): Promise<[string, string]> {
  if (!owner) {
    owner = 'owner';
  }

  if (!club) {
    club = 'bbc';
  }
  const client = getClient();
  // let resp = await client.mutate({
  //   variables: ownerInput,
  //   mutation: createPlayerQuery,
  // });
  let resp = await signup(owner, 'abc123');
  const ownerId = resp['uuid'];
  const clubInput = {
    input: {
      name: club,
      description: 'poker players gather',
    },
  };
  const ownerClient = getClient(ownerId);

  // get my clubs
  const myClubs = await getMyClubs(ownerId);
  console.log(`My clubs: ${JSON.stringify(myClubs)}`);

  // use the player in the auth header
  resp = await ownerClient.mutate({
    variables: clubInput,
    mutation: createClubQuery,
  });
  const clubCode = resp.data.clubCode;

  return [clubCode, ownerId];
}

export const kickMember = async ({clubCode, ownerId, playerUuid}) => {
  const ownerClient = getClient(ownerId);
  const variables = {
    clubCode,
    playerUuid,
  };
  const resp = await ownerClient.mutate({
    variables,
    mutation: kickedClubQuery,
  });
  return resp.data;
};

export const rejectMember = async ({clubCode, ownerId, playerUuid}) => {
  const ownerClient = getClient(ownerId);
  const variables = {
    clubCode,
    playerUuid,
  };
  const resp = await ownerClient.mutate({
    variables,
    mutation: rejectClubQuery,
  });
  return resp.data;
};

export const deleteClub = async ({clubCode, ownerId}) => {
  const ownerClient = getClient(ownerId);
  const variables = {
    clubCode,
  };
  const resp = await ownerClient.mutate({
    variables,
    mutation: deleteClubQuery,
  });
  return resp.data;
};

export const sendClubFcmMessage = async ({ownerId, clubCode, message}) => {
  const ownerClient = getClient(ownerId);
  const variables = {
    clubCode,
    message,
  };
  const resp = await ownerClient.mutate({
    variables,
    mutation: sendClubFcmMessageQuery,
  });
  return resp.data;
};

export const leaderboard = async ({ownerId, clubCode}) => {
  const ownerClient = getClient(ownerId);
  const variables = {
    clubCode,
  };
  const resp = await ownerClient.mutate({
    variables,
    mutation: leaderboardQuery,
  });
  return resp.data;
};
