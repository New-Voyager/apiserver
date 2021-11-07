import {resetDatabase, getClient, startGqlServer} from './utils/utils';
import * as clubutils from './utils/club.testutils';
import {getLogger} from '../src/utils/log';
const logger = getLogger('club');

describe('Club APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });

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
    } catch (error) {
      expect((error as any).toString()).toContain('Unauthorized');
    }

    logger.debug(`Owner id before using in getClient ${ownerId}`);
    const ownerClient = await getClient(ownerId);
    // use the player in the auth header
    let resp = await ownerClient.mutate({
      variables: clubInput,
      mutation: clubutils.createClubQuery,
    });
    expect(resp.errors).toBeUndefined();
    expect(resp.data).not.toBeUndefined();
    const clubCode = resp.data.clubCode;
    expect(clubCode).not.toBeNull();

    // update the club name using the player token
    const playerClient = getClient(player1Id);
    const clubUpdateInput = {
      clubCode: clubCode,
      input: clubInput['input'],
    };

    const withoutClient = getClient();
    try {
      await withoutClient.mutate({
        variables: clubUpdateInput,
        mutation: clubutils.updateClubQuery,
      });
    } catch (error) {
      expect((error as any).toString()).toContain('Unauthorized');
    }

    const clubUpdateInputInvalid = {
      clubCode: 'invalidClub',
      input: clubInput['input'],
    };

    try {
      await playerClient.mutate({
        variables: clubUpdateInputInvalid,
        mutation: clubutils.updateClubQuery,
      });
    } catch (error) {
      expect((error as any).toString()).toEqual(
        'Error: GraphQL error: Club invalidClub is not found'
      );
    }

    try {
      await ownerClient.mutate({
        variables: {
          clubCode,
          input: {
            name: '',
          },
        },
        mutation: clubutils.updateClubQuery,
      });
    } catch (error) {
      expect((error as any).toString()).toEqual('name is a required field');
    }

    try {
      await ownerClient.mutate({
        variables: {
          clubCode,
          input: {
            name: 'qwe',
            description: '',
          },
        },
        mutation: clubutils.updateClubQuery,
      });
      console.log('DONEEEÈ');
    } catch (error) {
      console.log(error);
      expect((error as any).toString()).toEqual('description is a required field');
    }

    try {
      await ownerClient.mutate({
        variables: {
          clubCode,
          input: {},
        },
        mutation: clubutils.updateClubQuery,
      });
    } catch (error) {
      expect((error as any).toString()).toEqual('club object not found');
    }

    // the owner of the club can update
    resp = await ownerClient.mutate({
      variables: clubUpdateInput,
      mutation: clubutils.updateClubQuery,
    });
    expect(resp.data.success).toBeTruthy();
  });

  test('player joins a club', async () => {
    const [clubCode] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');
    // try to join the club without auth header
    const client = getClient();
    const variables = {
      clubCode: clubCode,
    };
    try {
      await client.query({
        variables: variables,
        query: clubutils.queryMemberStatus,
      });
      expect(false).toBeTruthy();
    } catch (error) {
      // FIXME: Later
      //expect((error as any).toString()).toContain('Unauthorized');
    }
    try {
      await client.mutate({
        variables: variables,
        mutation: clubutils.joinClubQuery,
      });
      expect(false).toBeTruthy();
    } catch (error) {
      expect((error as any).toString()).toContain('Unauthorized');
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
    const [clubCode] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    const player2Id = await clubutils.createPlayer('eve', '1243EDF');
    await clubutils.playerJoinsClub(clubCode, player1Id);
    await clubutils.playerJoinsClub(clubCode, player2Id);

    // try to join the club without auth header
    const variables = {
      clubCode: clubCode,
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
      expect((error as any).toString()).toContain('Unauthorized');
    }
  });

  test('owner approves a new member', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    const player2Id = await clubutils.createPlayer('eve', '1243EDF');
    await clubutils.playerJoinsClub(clubCode, player1Id);
    await clubutils.playerJoinsClub(clubCode, player2Id);
    // let the owner approve the request
    const ownerClient = getClient(ownerId);
    let variables = {
      clubCode: clubCode,
      playerUuid: player1Id,
    };
    let resp = await ownerClient.mutate({
      variables: variables,
      mutation: clubutils.approveClubQuery,
    });
    expect(resp.data.status).toBe('ACTIVE');
    variables = {
      clubCode: clubCode,
      playerUuid: player2Id,
    };
    resp = await ownerClient.mutate({
      variables: variables,
      mutation: clubutils.approveClubQuery,
    });
    expect(resp.data.status).toBe('ACTIVE');

    const clubMembers = await clubutils.getClubMembers(ownerId, clubCode);
    // owner + 2 players
    expect(clubMembers).toHaveLength(3);
    for (const member of clubMembers) {
      expect(member.status).toBe('ACTIVE');
    }
  });

  test('owner rejects a new member request', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    const player2Id = await clubutils.createPlayer('eve', '1243EDF');
    await clubutils.playerJoinsClub(clubCode, player1Id);
    await clubutils.playerJoinsClub(clubCode, player2Id);

    // query members and ensure the status is PENDING
    let clubMembers = await clubutils.getClubMembers(ownerId, clubCode);
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
      clubCode: clubCode,
      playerUuid: player1Id,
    };
    let resp = await ownerClient.mutate({
      variables: variables,
      mutation: clubutils.rejectClubQuery,
    });
    expect(resp.data.status).toBe('DENIED');
    variables = {
      clubCode: clubCode,
      playerUuid: player2Id,
    };
    resp = await ownerClient.mutate({
      variables: variables,
      mutation: clubutils.approveClubQuery,
    });
    expect(resp.data.status).toBe('ACTIVE');

    clubMembers = await clubutils.getClubMembers(ownerId, clubCode);
    // owner + 2 players
    expect(clubMembers).toHaveLength(2);
  });

  test('owner kicks an existing member request', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    const player2Id = await clubutils.createPlayer('eve', '1243EDF');
    await clubutils.playerJoinsClub(clubCode, player1Id);
    await clubutils.playerJoinsClub(clubCode, player2Id);

    // let the owner approve the request
    const ownerClient = getClient(ownerId);
    let variables = {
      clubCode: clubCode,
      playerUuid: player1Id,
    };
    await ownerClient.mutate({
      variables: variables,
      mutation: clubutils.approveClubQuery,
    });
    variables = {
      clubCode: clubCode,
      playerUuid: player2Id,
    };
    await ownerClient.mutate({
      variables: variables,
      mutation: clubutils.approveClubQuery,
    });

    // get club members as player1
    let clubMembers = await clubutils.getClubMembers(player1Id, clubCode);
    // owner + 2 players
    expect(clubMembers).toHaveLength(3);
    for (const member of clubMembers) {
      expect(member.status).toBe('ACTIVE');
    }

    // kick player1, he should not be able to access the club
    variables = {
      clubCode: clubCode,
      playerUuid: player1Id,
    };
    await ownerClient.mutate({
      variables: variables,
      mutation: clubutils.kickedClubQuery,
    });

    // get club members as owner
    clubMembers = await clubutils.getClubMembers(ownerId, clubCode);
    // owner + 2 players
    expect(clubMembers).toHaveLength(2);

    // get club members as the player who got kicked out
    try {
      clubMembers = await clubutils.getClubMembers(player1Id, clubCode);
      expect(false).toBeTruthy();
    } catch (error) {
      expect((error as any).toString()).toContain('Unauthorized');
    }
  });

  test('player leaves a club', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    const player2Id = await clubutils.createPlayer('eve', '1243EDF');
    await clubutils.playerJoinsClub(clubCode, player1Id);
    await clubutils.playerJoinsClub(clubCode, player2Id);
    await clubutils.approvePlayer(clubCode, ownerId, player1Id);
    // make sure the owner cannot leave the club
    const ownerClient = getClient(ownerId);
    let variables = {
      clubCode: clubCode,
    };
    try {
      await ownerClient.mutate({
        variables: variables,
        mutation: clubutils.leaveClubQuery,
      });
      expect(false).toBeTruthy();
    } catch (error) {
      expect((error as any).toString()).toContain('Owner cannot leave the club');
    }

    const player1Client = getClient(player1Id);
    variables = {
      clubCode: clubCode,
    };
    await player1Client.mutate({
      variables: variables,
      mutation: clubutils.leaveClubQuery,
    });

    // get club members and ensure player 1 is not in the club
    const members = await clubutils.getClubMembers(ownerId, clubCode);
    let player1Found = false;
    for (const member of members) {
      if (member.playerId === player1Id) {
        player1Found = true;
      }
    }
    expect(player1Found).toBeFalsy();
  });

  test('update a clubMember', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, player1Id);
    await clubutils.approvePlayer(clubCode, ownerId, player1Id);

    try {
      await clubutils.updateClubMember('', ownerId, player1Id, {
        notes: 'Kicked out',
        status: 'KICKEDOUT',
        autoBuyinApproval: true,
        referredBy: ownerId,
      });
    } catch (error) {
      const expectedError = 'clubCode is a required field';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
    try {
      await clubutils.updateClubMember(clubCode, '', player1Id, {
        notes: 'Kicked out',
        status: 'KICKEDOUT',
        autoBuyinApproval: true,
        referredBy: ownerId,
      });
    } catch (error) {
      const expectedError = 'Unauthorized';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
    try {
      await clubutils.updateClubMember(clubCode, ownerId, '', {
        notes: 'Kicked out',
        status: 'KICKEDOUT',
        autoBuyinApproval: true,
        referredBy: ownerId,
      });
    } catch (error) {
      const expectedError = 'playerUuid is a required field';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    const resp = await clubutils.updateClubMember(
      clubCode,
      ownerId,
      player1Id,
      {
        notes: 'Kicked out',
        status: 'KICKEDOUT',
        autoBuyinApproval: true,
        referredBy: ownerId,
      }
    );
    expect(resp.status).toBe('KICKEDOUT');
  });

  test('kick member without playerUuid', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, player1Id);
    await clubutils.approvePlayer(clubCode, ownerId, player1Id);

    try {
      await clubutils.kickMember({
        clubCode,
        ownerId,
        playerUuid: '',
      });
    } catch (error) {
      const expectedError = 'playerUuid is a required field';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await clubutils.kickMember({
        clubCode,
        ownerId: '',
        playerUuid: player1Id,
      });
    } catch (error) {
      const expectedError = 'Unauthorized';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
    try {
      await clubutils.kickMember({
        clubCode: '',
        ownerId,
        playerUuid: player1Id,
      });
    } catch (error) {
      const expectedError = 'clubCode is a required field';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
  });

  test('reject player without clubCode', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, player1Id);

    try {
      await clubutils.rejectMember({
        clubCode: '',
        ownerId,
        playerUuid: player1Id,
      });
    } catch (error) {
      const expectedError = 'clubCode is a required field';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await clubutils.rejectMember({
        clubCode,
        ownerId: '',
        playerUuid: player1Id,
      });
    } catch (error) {
      const expectedError = 'Unauthorized';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await clubutils.rejectMember({
        clubCode,
        ownerId,
        playerUuid: '',
      });
    } catch (error) {
      const expectedError = 'playerUuid is a required field';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
  });

  test('Approve player without clubCode', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    await clubutils.playerJoinsClub(clubCode, player1Id);

    try {
      await clubutils.approvePlayer('', ownerId, player1Id);
    } catch (error) {
      const expectedError = 'clubCode is a required field';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await clubutils.approvePlayer(clubCode, ownerId, '');
    } catch (error) {
      const expectedError = 'playerUuid is a required field';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await clubutils.approvePlayer(clubCode, '', player1Id);
    } catch (error) {
      const expectedError = 'Unauthorized';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
  });

  test('Player join club without clubCode', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');

    try {
      await clubutils.playerJoinsClub('', player1Id);
    } catch (error) {
      const expectedError = 'clubCode is a required field';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await clubutils.playerJoinsClub(clubCode, '');
    } catch (error) {
      const expectedError = 'Unauthorized';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
  });

  test('Delete club', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');

    try {
      await clubutils.deleteClub({clubCode: '', ownerId: player1Id});
    } catch (error) {
      const expectedError = 'clubCode is a required field';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await clubutils.deleteClub({clubCode, ownerId: ''});
    } catch (error) {
      const expectedError = 'Unauthorized';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
    try {
      await clubutils.deleteClub({clubCode, ownerId: player1Id});
    } catch (error) {
      const expectedError = 'Unauthorized. Only owner can delete the club';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await clubutils.deleteClub({clubCode: 'test', ownerId});
    } catch (error) {
      const expectedError = 'Club: test does not exist';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    const data = await clubutils.deleteClub({clubCode, ownerId});
    expect(data.success).toEqual(true);
  });

  test('Send message', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    try {
      await clubutils.sendClubFcmMessage({
        clubCode: 'test',
        ownerId: '',
        message: {test: 'test'},
      });
    } catch (error) {
      const expectedError = 'Club test is not found';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    await clubutils.sendClubFcmMessage({
      clubCode,
      ownerId,
      message: {test: 'test'},
    });
  });

  test('leaderboard', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const player1Id = await clubutils.createPlayer('adam', '1243ABC');
    try {
      await clubutils.leaderboard({
        clubCode,
        ownerId: '',
      });
    } catch (error) {
      const expectedError =
        'Cannot find player uuid [undefined] in player repo';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }
    try {
      await clubutils.leaderboard({
        clubCode: 'test',
        ownerId,
      });
    } catch (error) {
      const expectedError = 'Cannot find club code [test] in club repo';
      expect((error as any).graphQLErrors[0].message).toEqual(expectedError);
    }

    await clubutils.leaderboard({
      clubCode,
      ownerId,
    });
  });
});
