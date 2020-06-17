import {resetDatabase, getClient} from './utils/utils';
import {gql} from 'apollo-boost';
const createPlayerQuery = gql`mutation($input: PlayerCreateInput!) { playerId: createPlayer(player: $input) }`;
const createClubQuery = gql`mutation($input: ClubCreateInput!) { clubId: createClub(club: $input) }`;
const updateClubQuery = gql`mutation($clubId: String!, $input: ClubUpdateInput!) { success: updateClub(clubId: $clubId, club: $input) }`;
const joinClubQuery = gql`mutation($clubId: String!) { status: joinClub(clubId: $clubId) }`;
const approveClubQuery = gql`mutation($clubId: String!, $playerUuid: String!) { status: approveMember(clubId: $clubId, playerUuid: $playerUuid) }`;
const kickedClubQuery = gql`mutation($clubId: String!, $playerUuid: String!) { status: kickMember(clubId: $clubId, playerUuid: $playerUuid) }`;

const queryClubMembers = gql`query($clubId: String!) { 
                                members: clubMembers(clubId: $clubId) { 
                                  name joinedDate status lastGamePlayedDate imageId isOwner isManager playerId                                  
                                }
                              }`;

const rejectClubQuery = gql`mutation($clubId: String!, $playerUuid: String!) { status: rejectMember(clubId: $clubId, playerUuid: $playerUuid) }`;


beforeAll(async (done) => {
  //server = new TestServer();
  //await server.start();
  await resetDatabase();
//  client = getClient();
  done();
});

afterAll(async (done) => {
  //await server.stop();
  done();
});

/**
 * Creates a club and returns clubId and owner id
 */
export async function createClub(): Promise<[string, string]> {
  const ownerInput = {
    input: {
      name: "owner",
      deviceId: "abc123",
    }
  };
  let client = getClient();
  let resp = await client.mutate({
    variables: ownerInput,
    mutation: createPlayerQuery,
  });
  const ownerId = resp.data.playerId;
  const clubInput = {
    input: {
      name: "bbc",
      description: "poker players gather",
    }
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
    }
  };
  let client = getClient();
  let resp = await client.mutate({
    variables: variables,
    mutation: createPlayerQuery,
  });
  return resp.data.playerId;
}

export async function playerJoinsClub(clubId: string, playerId: string) {
  const playerClient = getClient(playerId);
  const variables = {
    clubId: clubId,
  }

  await playerClient.mutate({
    variables: variables,
    mutation: joinClubQuery,
  });
}

async function getClubMembers(playerId: string, clubId: string): Promise<Array<any>> {
  const playerClient = getClient(playerId);
  const variables = {
    clubId: clubId,
  }

  let resp = await playerClient.query({
    variables: variables,
    query: queryClubMembers,
  });

  return resp.data.members;
}

describe('Club APIs', () => {
  test("create a club", async () => {
    const ownerId = await createPlayer("owner", "abc123");
    const player1Id = await createPlayer("player1", "test123");
    expect(ownerId).not.toBeNull();
    expect(player1Id).not.toBeNull();
    expect(ownerId).not.toBeUndefined();
    expect(player1Id).not.toBeUndefined();

    const clubInput = {
      input: {
        name: "bbc",
        description: "poker players gather",
      }
    };
    
    const client = getClient();
    try {
      // use the TEST client
      await client.mutate({
        variables: clubInput,
        mutation: createClubQuery,
      });
      expect(false).toBeTruthy();
    } catch(error) {
      expect(error.toString()).toContain('Unauthorized');
    }

    console.log(`Owner id before using in getClient ${ownerId}`);
    const ownerClient = await getClient(ownerId);
    // use the player in the auth header
    let resp = await ownerClient.mutate({
      variables: clubInput,
      mutation: createClubQuery,
    });
    expect(resp.errors).toBeUndefined();
    expect(resp.data).not.toBeUndefined();
    let clubId = resp.data.clubId;    
    expect(clubId).not.toBeNull();

    // update the club name using the player token
    const playerClient = getClient(player1Id);
    const clubUpdateInput = {
      clubId: clubId,
      input: clubInput["input"],
    };

    try {
      await playerClient.mutate({
        variables: clubUpdateInput,
        mutation: updateClubQuery,
      });
      expect(false).toBeTruthy();
    } catch(error) {
      expect(error.toString()).toContain('Unauthorized');
    }
    

    // the owner of the club can update
    resp = await ownerClient.mutate({
      variables: clubUpdateInput,
      mutation: updateClubQuery,
    });    
    expect(resp.data.success).toBeTruthy();
  });

  test("player joins a club", async () => {
    const [clubId, ] = await createClub();
    const playerId = await createPlayer("adam", "1243ABC");
    // try to join the club without auth header
    const client = getClient();
    let variables = {
      clubId: clubId
    };
    try {
      await client.mutate({
        variables: variables,
        mutation: joinClubQuery,
      });
      expect(false).toBeTruthy();
    } catch(error) {
      expect(error.toString()).toContain('Unauthorized');
    }
    const playerClient = getClient(playerId);
    let resp = await playerClient.mutate({
      variables: variables,
      mutation: joinClubQuery,
    });
    
    expect(resp.errors).toBeUndefined();
    expect(resp.data).not.toBeUndefined();
    let status = resp.data.status;    
    expect(status).toBe('PENDING');
  });

  test("player who is not an owner approves a new member", async () => {
    const [clubId, ] = await createClub();
    const player1Id = await createPlayer("adam", "1243ABC");
    const player2Id = await createPlayer("eve", "1243EDF");
    await playerJoinsClub(clubId, player1Id);
    await playerJoinsClub(clubId, player2Id);
    
    // try to join the club without auth header
    let variables = {
      clubId: clubId,
      playerUuid: player2Id
    };
    // player1 whose status is in PENDING approves player2
    const player1Client = getClient(player1Id);
    try {
      await player1Client.mutate({
        variables: variables,
        mutation: approveClubQuery,
      });
      expect(false).toBeTruthy();
    } catch(error) {
      expect(error.toString()).toContain('Unauthorized');
    }
  });

  test("owner approves a new member", async () => {
    const [clubId, ownerId] = await createClub();
    const player1Id = await createPlayer("adam", "1243ABC");
    const player2Id = await createPlayer("eve", "1243EDF");
    await playerJoinsClub(clubId, player1Id);
    await playerJoinsClub(clubId, player2Id);
    // let the owner approve the request
    const ownerClient = getClient(ownerId);
    let variables = {
      clubId: clubId,
      playerUuid: player1Id
    };
    let resp = await ownerClient.mutate({
      variables: variables,
      mutation: approveClubQuery,
    });
    expect(resp.data.status).toBe('APPROVED');
    variables = {
      clubId: clubId,
      playerUuid: player2Id
    };
    resp = await ownerClient.mutate({
      variables: variables,
      mutation: approveClubQuery,
    });
    expect(resp.data.status).toBe('APPROVED');

    const clubMembers = await getClubMembers(ownerId, clubId);
    // owner + 2 players
    expect(clubMembers).toHaveLength(3);
    for(const member of clubMembers) {
      expect(member.status).toBe('APPROVED');
    }
  });

  test("owner rejects a new member request", async () => {
    const [clubId, ownerId] = await createClub();
    const player1Id = await createPlayer("adam", "1243ABC");
    const player2Id = await createPlayer("eve", "1243EDF");
    await playerJoinsClub(clubId, player1Id);
    await playerJoinsClub(clubId, player2Id);

    // query members and ensure the status is PENDING
    let clubMembers = await getClubMembers(ownerId, clubId);
    // owner + 2 players
    expect(clubMembers).toHaveLength(3);
    for(const member of clubMembers) {
      if (member.playerId === ownerId) {
        expect(member.status).toBe('APPROVED');
      } else {
        expect(member.status).toBe('PENDING');
      }
    }

    // let the owner approve the request
    const ownerClient = getClient(ownerId);
    let variables = {
      clubId: clubId,
      playerUuid: player1Id
    };
    let resp = await ownerClient.mutate({
      variables: variables,
      mutation: rejectClubQuery,
    });
    expect(resp.data.status).toBe('DENIED');
    variables = {
      clubId: clubId,
      playerUuid: player2Id
    };
    resp = await ownerClient.mutate({
      variables: variables,
      mutation: approveClubQuery,
    });
    expect(resp.data.status).toBe('APPROVED');

    clubMembers = await getClubMembers(ownerId, clubId);
    // owner + 2 players
    expect(clubMembers).toHaveLength(3);
    for(const member of clubMembers) {
      if (member.playerId === player1Id) {
        expect(member.status).toBe('DENIED');
      } else {
        expect(member.status).toBe('APPROVED');
      }
    }
  });


  test("owner kicks an existing member request", async () => {
    const [clubId, ownerId] = await createClub();
    const player1Id = await createPlayer("adam", "1243ABC");
    const player2Id = await createPlayer("eve", "1243EDF");
    await playerJoinsClub(clubId, player1Id);
    await playerJoinsClub(clubId, player2Id);

    // let the owner approve the request
    const ownerClient = getClient(ownerId);
    let variables = {
      clubId: clubId,
      playerUuid: player1Id
    };
    await ownerClient.mutate({
      variables: variables,
      mutation: approveClubQuery,
    });
    variables = {
      clubId: clubId,
      playerUuid: player2Id
    };
    await ownerClient.mutate({
      variables: variables,
      mutation: approveClubQuery,
    });

    // get club members as player1
    let clubMembers = await getClubMembers(player1Id, clubId);
    // owner + 2 players
    expect(clubMembers).toHaveLength(3);
    for(const member of clubMembers) {
      expect(member.status).toBe('APPROVED');
    }

    // kick player1, he should not be able to access the club
    variables = {
      clubId: clubId,
      playerUuid: player1Id
    };   
    await ownerClient.mutate({
      variables: variables,
      mutation: kickedClubQuery,
    });

    // get club members as owner
    clubMembers = await getClubMembers(ownerId, clubId);
    // owner + 2 players
    expect(clubMembers).toHaveLength(3);
    for(const member of clubMembers) {
      if(member.playerId === player1Id) {
        expect(member.status).toBe('KICKEDOUT');
      } else {
        expect(member.status).toBe('APPROVED');
      }
    }

    // get club members as the player who got kicked out
    try {
      clubMembers = await getClubMembers(player1Id, clubId);
      expect(false).toBeTruthy();
    } catch(error) {
      expect(error.toString()).toContain('Unauthorized');
    }
  });  
});