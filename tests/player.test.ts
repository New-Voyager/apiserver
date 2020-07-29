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
    const [clubCode1] = await clubutils.createClub();
    const [club2Code] = await clubutils.createClub('owner','test');
    const player1 = await clubutils.createPlayer('player1', 'ABCDE');
    await clubutils.playerJoinsClub(clubCode1, player1);
    await clubutils.playerJoinsClub(club2Code, player1);
    const player2 = await clubutils.createPlayer('player2', '12345');
    await clubutils.playerJoinsClub(club2Code, player2);
    const player1Clubs = await clubutils.getMyClubs(player1);
    console.log(player1Clubs)
    expect(player1Clubs).toHaveLength(2);
    const player2Clubs = await clubutils.getMyClubs(player2);
    expect(player2Clubs).toHaveLength(1);
    console.log(player2Clubs);
    const club2 = player2Clubs[0];
    console.log(club2.clubCode);
    expect(club2.name).not.toBeNull();
    expect(club2.clubCode).toEqual(club2Code);
  });
});
