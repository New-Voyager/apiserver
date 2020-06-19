import {resetDatabase, getClient} from './utils/utils';
import {gql} from 'apollo-boost';
import * as clubutils from './utils/club.testutils';

beforeAll(async done => {
  await resetDatabase();
  done();
});

afterAll(async done => {
  done();
});

describe('Player APIs', () => {
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
    const [club1Id] = await clubutils.createClub();
    const [club2Id] = await clubutils.createClub();
    const player1 = await clubutils.createPlayer('player1', 'ABCDE');
    await clubutils.playerJoinsClub(club1Id, player1);
    await clubutils.playerJoinsClub(club2Id, player1);
    const player2 = await clubutils.createPlayer('player2', '12345');
    await clubutils.playerJoinsClub(club2Id, player2);
    const player1Clubs = await clubutils.getMyClubs(player1);
    expect(player1Clubs).toHaveLength(2);
    const player2Clubs = await clubutils.getMyClubs(player2);
    expect(player2Clubs).toHaveLength(1);
    const club2 = player2Clubs[0];
    expect(club2.name).not.toBeNull();
    expect(club2.clubId).toEqual(club2Id);
  });
});
