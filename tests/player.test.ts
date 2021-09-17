import {resetDatabase, getClient, startGqlServer} from './utils/utils';
import {gql} from 'apollo-boost';
import * as clubutils from './utils/club.testutils';

describe('Player APIs', () => {
  let stop, graphql;

  beforeAll(async done => {
    const testServer = await startGqlServer();
    stop = testServer.stop;
    graphql = testServer.graphql;
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    stop();
    done();
  });

  test('create a player', async () => {
    const createPlayer = gql`
      mutation($input: PlayerCreateInput!) {
        playerId: createPlayer(player: $input)
      }
    `;
    const resp = await getClient().mutate({
      variables: {
        input: {
          name: 'test',
          deviceId: 'abc123',
        },
      },
      mutation: createPlayer,
    });
    expect(resp.errors).toBeUndefined();
    expect(resp.data).not.toBeNull();
    const playerId = resp.data.playerId;
    expect(playerId).not.toBeNull();
  });

  test('create a duplicate player', async () => {
    const createPlayer = gql`
      mutation($input: PlayerCreateInput!) {
        playerId: createPlayer(player: $input)
      }
    `;
    let resp = await getClient().mutate({
      variables: {
        input: {
          name: 'test',
          deviceId: 'abc123',
        },
      },
      mutation: createPlayer,
    });
    const playerId = resp.data.playerId;
    expect(playerId).not.toBeNull();

    resp = await getClient().mutate({
      variables: {
        input: {
          name: 'test',
          deviceId: 'abc123',
        },
      },
      mutation: createPlayer,
    });
    expect(resp.errors).toBeUndefined();
    expect(resp.data).not.toBeNull();
    const playerId2 = resp.data.playerId;
    expect(playerId2).toEqual(playerId);
  });

  test('get my clubs', async () => {
    const [clubCode1] = await clubutils.createClub();
    const [club2Code] = await clubutils.createClub('owner', 'test');
    const player1 = await clubutils.createPlayer('player1', 'ABCDE');
    await clubutils.playerJoinsClub(clubCode1, player1);
    await clubutils.playerJoinsClub(club2Code, player1);
    const player2 = await clubutils.createPlayer('player2', '12345');
    await clubutils.playerJoinsClub(club2Code, player2);
    const player1Clubs = await clubutils.getMyClubs(player1);
    expect(player1Clubs).toHaveLength(2);
    const player2Clubs = await clubutils.getMyClubs(player2);
    expect(player2Clubs).toHaveLength(1);
    const club2 = player2Clubs[0];
    expect(club2.name).not.toBeNull();
    expect(club2.clubCode).toEqual(club2Code);
  });

  test('change display name', async () => {
    const [clubCode1, owner1] = await clubutils.createClub('owner1', 'test1');
    const [clubCode2, owner2] = await clubutils.createClub('owner2', 'test2');
    const player1 = await clubutils.createPlayer('player1', 'ABCDEnew');
    await clubutils.playerJoinsClub(clubCode1, player1);
    await clubutils.playerJoinsClub(clubCode2, player1);
    const player1Clubs = await clubutils.getMyClubs(player1);
    expect(player1Clubs).toHaveLength(2);

    await clubutils.changeDisplayName(player1, 'sanjay');
  });
});
