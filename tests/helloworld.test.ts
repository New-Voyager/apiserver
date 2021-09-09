import {resetDatabase, getClient, sleep, getClubs} from './utils/utils';
import {gql} from 'apollo-boost';
import * as clubutils from './utils/club.testutils';
import * as handutils from './utils/hand.testutils';
import { getApolloServer } from '../src/server';
//import { getApolloServer } from './testSetup';
//import { getApolloServerInstance } from '../src/server';


// default player, game and club inputs
const ownerInput = {
  name: 'player_name',
  deviceId: 'abc123',
};

const clubInput = {
  name: 'club_name',
  description: 'poker players gather',
};

const playersInput = [
  {
    name: 'player_name1',
    deviceId: 'abc1234',
  },
  {
    name: 'player_3',
    deviceId: 'abc123456',
  },
  {
    name: 'john',
    deviceId: 'abc1235',
  },
];

async function createClubWithMembers(
  ownerInput: any,
  clubInput: any,
  players: Array<any>
): Promise<[string, string, number, Array<string>, Array<number>]> {
  const [clubCode, ownerUuid] = await clubutils.createClub('brady', 'yatzee');
  const clubId = await clubutils.getClubById(clubCode);
  const playerUuids = new Array<string>();
  const playerIds = new Array<number>();
  for (const playerInput of players) {
    const playerUuid = await clubutils.createPlayer(
      playerInput.name,
      playerInput.deviceId
    );
    const playerId = await handutils.getPlayerById(playerUuid);
    await clubutils.playerJoinsClub(clubCode, playerUuid);
    await clubutils.approvePlayer(clubCode, ownerUuid, playerUuid);
    playerUuids.push(playerUuid);
    playerIds.push(playerId);
  }
  return [ownerUuid, clubCode, clubId, playerUuids, playerIds];
}

beforeAll(async done => {
  //await resetDatabase();
  done();
});

afterAll(async done => {
  done();
});



const createPlayerQuery = `
  mutation($input: PlayerCreateInput!) {
    playerId: createPlayer(player: $input)
  }
`;

async function createPlayerTest(name: string, deviceId: string) {
  const variables = {
    input: {
      name: name,
      deviceId: deviceId,
    },
  };
  // const client = getClient();
  // const resp = await client.mutate({
  //   variables: variables,
  //   mutation: createPlayerQuery,
  // });
  
  // return resp.data.playerId;
  const server = getApolloServer();
  const resp = await server.executeOperation({query: createPlayerQuery, variables: variables});
  console.log(`response: ${JSON.stringify(resp)}`);
  return resp.data.playerId;
}

describe('Test APIs', () => {

  test('get my clubs', async () => {
    //sleep(5000);
    const playerUuid = await createPlayerTest(
      'eugene',
      '123456'
    );
    // const [
    //   owner,
    //   clubCode,
    //   clubId,
    //   playerUuids,
    //   playerIds,
    // ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
  })
});