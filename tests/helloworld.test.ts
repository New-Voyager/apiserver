import {
  resetDatabase,
  getClient,
  sleep,
  getClubs,
  startGqlServer,
} from './utils/utils';
import {gql, toPromise} from 'apollo-boost';
import * as clubutils from './utils/club.testutils';
import * as handutils from './utils/hand.testutils';
import {getApolloServer} from '../src/server';
import {createClub2} from './utils/club.testutils';
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

const createPlayerQuery = `
  mutation($input: PlayerCreateInput!) {
    playerId: createPlayer(player: $input)
  }
`;

async function createPlayerTest(graphql: any, name: string, deviceId: string) {
  const variables = {
    input: {
      name: name,
      deviceId: deviceId,
    },
  };
  const resp = (await toPromise(
    graphql({query: createPlayerQuery, variables: variables})
  )) as any;
  console.log(`response: ${JSON.stringify(resp)}`);
  return resp.data.playerId;
}

describe('Test APIs', () => {
  test('create player', async () => {
    await createClub2(null, 'test', 'test123');
    console.log('successful');
  });
});
