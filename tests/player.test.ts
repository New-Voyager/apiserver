import {resetDatabase, getClient} from './utils/utils';
import {gql} from 'apollo-boost';
import {createClub, createPlayer, playerJoinsClub} from './club.test';

const myClubsQuery = gql`
  query {
    clubs: myClubs {
      name
      private
    }
  }
`;

async function getMyClubs(playerId: string): Promise<Array<any>> {
  const playerClient = getClient(playerId);
  const resp = await playerClient.query({
    query: myClubsQuery,
  });

  return resp.data.clubs;
}

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
    const [club1Id] = await createClub();
    const [club2Id] = await createClub();
    const player1 = await createPlayer('player1', 'ABCDE');
    await playerJoinsClub(club1Id, player1);
    await playerJoinsClub(club2Id, player1);
    const player2 = await createPlayer('player2', '12345');
    await playerJoinsClub(club2Id, player2);
    const player1Clubs = await getMyClubs(player1);
    expect(player1Clubs).toHaveLength(2);
    const player2Clubs = await getMyClubs(player2);
    expect(player2Clubs).toHaveLength(1);
  });
});
