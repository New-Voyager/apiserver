import {resetDatabase, getClient} from './utils/utils';
import * as clubutils from './utils/club.testutils';

beforeAll(async done => {
  //server = new TestServer();
  //await server.start();
  await resetDatabase();
  //  client = getClient();
  done();
});

afterAll(async done => {
  //await server.stop();
  done();
});

describe('Club APIs', () => {
  test('create a club', async () => {
    const ownerId = await clubutils.createPlayer('owner', 'abc123');
    const player1Id = await clubutils.createPlayer('player1', 'test123');
    expect(ownerId).not.toBeNull();
    expect(player1Id).not.toBeNull();
    expect(ownerId).not.toBeUndefined();
    expect(player1Id).not.toBeUndefined();

    const clubInput = {
      input: {
        name: 'bbc',
        description: 'poker players gather',
      },
    };

    const client = getClient();
    try {
      // use the TEST client
      await client.mutate({
        variables: clubInput,
        mutation: clubutils.createClubQuery,
      });
      expect(false).toBeTruthy();
    } catch (error) {
      expect(error.toString()).toContain('Unauthorized');
    }

    console.log(`Owner id before using in getClient ${ownerId}`);
    const ownerClient = await getClient(ownerId);
    // use the player in the auth header
    let resp = await ownerClient.mutate({
      variables: clubInput,
      mutation: clubutils.createClubQuery,
    });
    expect(resp.errors).toBeUndefined();
    expect(resp.data).not.toBeUndefined();
    const clubId = resp.data.clubId;
    expect(clubId).not.toBeNull();

    // update the club name using the player token
    const playerClient = getClient(player1Id);
    const clubUpdateInput = {
      clubId: clubId,
      input: clubInput['input'],
    };

    try {
      await playerClient.mutate({
        variables: clubUpdateInput,
        mutation: clubutils.updateClubQuery,
      });
      expect(false).toBeTruthy();
    } catch (error) {
      expect(error.toString()).toContain('Unauthorized');
    }

    // the owner of the club can update
    resp = await ownerClient.mutate({
      variables: clubUpdateInput,
      mutation: clubutils.updateClubQuery,
    });
    expect(resp.data.success).toBeTruthy();
  });

  test('player joins a club', async () => {
    const [clubId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    // try to join the club without auth header
    const client = getClient();
    const variables = {
      clubId: clubId,
    };
    try {
      await client.mutate({
        variables: variables,
        mutation: clubutils.joinClubQuery,
      });
      expect(false).toBeTruthy();
    } catch (error) {
      expect(error.toString()).toContain('Unauthorized');
    }
    const playerClient = getClient(playerId);
    const resp = await playerClient.mutate({
      variables: variables,
      mutation: clubutils.joinClubQuery,
    });

    expect(resp.errors).toBeUndefined();
    expect(resp.data).not.toBeUndefined();
    const status = resp.data.status;
    expect(status).toBe('PENDING');
  });

  test('player who is not an owner approves a new member', async () => {
    const [clubId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    const player2Id = await clubutils.createPlayer('eve', '1243EDF');
    await clubutils.playerJoinsClub(clubId, player1Id);
    await clubutils.playerJoinsClub(clubId, player2Id);

    // try to join the club without auth header
    const variables = {
      clubId: clubId,
      playerUuid: player2Id,
    };
    // player1 whose status is in PENDING approves player2
    const player1Client = getClient(player1Id);
    try {
      await player1Client.mutate({
        variables: variables,
        mutation: clubutils.approveClubQuery,
      });
      expect(false).toBeTruthy();
    } catch (error) {
      expect(error.toString()).toContain('Unauthorized');
    }
  });

  test('owner approves a new member', async () => {
    const [clubId, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    const player2Id = await clubutils.createPlayer('eve', '1243EDF');
    await clubutils.playerJoinsClub(clubId, player1Id);
    await clubutils.playerJoinsClub(clubId, player2Id);
    // let the owner approve the request
    const ownerClient = getClient(ownerId);
    let variables = {
      clubId: clubId,
      playerUuid: player1Id,
    };
    let resp = await ownerClient.mutate({
      variables: variables,
      mutation: clubutils.approveClubQuery,
    });
    expect(resp.data.status).toBe('ACTIVE');
    variables = {
      clubId: clubId,
      playerUuid: player2Id,
    };
    resp = await ownerClient.mutate({
      variables: variables,
      mutation: clubutils.approveClubQuery,
    });
    expect(resp.data.status).toBe('ACTIVE');

    const clubMembers = await clubutils.getClubMembers(ownerId, clubId);
    // owner + 2 players
    expect(clubMembers).toHaveLength(3);
    for (const member of clubMembers) {
      expect(member.status).toBe('ACTIVE');
    }
  });

  test('owner rejects a new member request', async () => {
    const [clubId, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    const player2Id = await clubutils.createPlayer('eve', '1243EDF');
    await clubutils.playerJoinsClub(clubId, player1Id);
    await clubutils.playerJoinsClub(clubId, player2Id);

    // query members and ensure the status is PENDING
    let clubMembers = await clubutils.getClubMembers(ownerId, clubId);
    // owner + 2 players
    expect(clubMembers).toHaveLength(3);
    for (const member of clubMembers) {
      if (member.playerId === ownerId) {
        expect(member.status).toBe('ACTIVE');
      } else {
        expect(member.status).toBe('PENDING');
      }
    }

    // let the owner approve the request
    const ownerClient = getClient(ownerId);
    let variables = {
      clubId: clubId,
      playerUuid: player1Id,
    };
    let resp = await ownerClient.mutate({
      variables: variables,
      mutation: clubutils.rejectClubQuery,
    });
    expect(resp.data.status).toBe('DENIED');
    variables = {
      clubId: clubId,
      playerUuid: player2Id,
    };
    resp = await ownerClient.mutate({
      variables: variables,
      mutation: clubutils.approveClubQuery,
    });
    expect(resp.data.status).toBe('ACTIVE');

    clubMembers = await clubutils.getClubMembers(ownerId, clubId);
    // owner + 2 players
    expect(clubMembers).toHaveLength(3);
    for (const member of clubMembers) {
      if (member.playerId === player1Id) {
        expect(member.status).toBe('DENIED');
      } else {
        expect(member.status).toBe('ACTIVE');
      }
    }
  });

  test('owner kicks an existing member request', async () => {
    const [clubId, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    const player2Id = await clubutils.createPlayer('eve', '1243EDF');
    await clubutils.playerJoinsClub(clubId, player1Id);
    await clubutils.playerJoinsClub(clubId, player2Id);

    // let the owner approve the request
    const ownerClient = getClient(ownerId);
    let variables = {
      clubId: clubId,
      playerUuid: player1Id,
    };
    await ownerClient.mutate({
      variables: variables,
      mutation: clubutils.approveClubQuery,
    });
    variables = {
      clubId: clubId,
      playerUuid: player2Id,
    };
    await ownerClient.mutate({
      variables: variables,
      mutation: clubutils.approveClubQuery,
    });

    // get club members as player1
    let clubMembers = await clubutils.getClubMembers(player1Id, clubId);
    // owner + 2 players
    expect(clubMembers).toHaveLength(3);
    for (const member of clubMembers) {
      expect(member.status).toBe('ACTIVE');
    }

    // kick player1, he should not be able to access the club
    variables = {
      clubId: clubId,
      playerUuid: player1Id,
    };
    await ownerClient.mutate({
      variables: variables,
      mutation: clubutils.kickedClubQuery,
    });

    // get club members as owner
    clubMembers = await clubutils.getClubMembers(ownerId, clubId);
    // owner + 2 players
    expect(clubMembers).toHaveLength(3);
    for (const member of clubMembers) {
      if (member.playerId === player1Id) {
        expect(member.status).toBe('KICKEDOUT');
      } else {
        expect(member.status).toBe('ACTIVE');
      }
    }

    // get club members as the player who got kicked out
    try {
      clubMembers = await clubutils.getClubMembers(player1Id, clubId);
      expect(false).toBeTruthy();
    } catch (error) {
      expect(error.toString()).toContain('Unauthorized');
    }
  });

  test('player leaves a club', async () => {
    const [clubId, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    const player2Id = await clubutils.createPlayer('eve', '1243EDF');
    await clubutils.playerJoinsClub(clubId, player1Id);
    await clubutils.playerJoinsClub(clubId, player2Id);
    await clubutils.approvePlayer(clubId, ownerId, player1Id);
    // make sure the owner cannot leave the club
    const ownerClient = getClient(ownerId);
    let variables = {
      clubId: clubId,
    };
    try {
      await ownerClient.mutate({
        variables: variables,
        mutation: clubutils.leaveClubQuery,
      });
      expect(false).toBeTruthy();
    } catch (error) {
      expect(error.toString()).toContain('Owner cannot leave the club');
    }

    const player1Client = getClient(player1Id);
    variables = {
      clubId: clubId,
    };
    await player1Client.mutate({
      variables: variables,
      mutation: clubutils.leaveClubQuery,
    });

    // get club members and ensure player 1 is not in the club
    const members = await clubutils.getClubMembers(ownerId, clubId);
    let player1Found = false;
    for (const member of members) {
      if (member.playerId === player1Id) {
        player1Found = true;
      }
    }
    expect(player1Found).toBeFalsy();
  });
});
