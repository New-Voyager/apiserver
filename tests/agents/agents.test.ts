import {createPlayers, getClient, INTERNAL_PORT, resetDatabase, runGame, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {configureGameQuery, joinGame, buyIn, createGameServer,  getPlayerById,  takeSeat} from '../game/utils';
import _ from 'lodash';

const players = [
  'young',
  'carol',
  'matt',
  'jim',
  'rob',
  'john'
]

const playersSeats = {
  'young': 1,
  'carol': 2,
  'matt': 3,
  'jim': 4,
  'rob': 5,
  'john': 6,
}



export const holdemGameInput = {
  gameType: 'HOLDEM',
  title: 'Friday game',
  smallBlind: 1.0,
  bigBlind: 2.0,
  straddleBet: 4.0,
  utgStraddleAllowed: true,
  buttonStraddleAllowed: false,
  minPlayers: 3,
  maxPlayers: 9,
  gameLength: 60,
  chipUnit: 'CENT',
  buyInLimit: 'BUYIN_NO_LIMIT',
  breakLength: 20,
  autoKickAfterBreak: true,
  waitForBigBlind: true,
  waitlistAllowed: true,
  maxWaitList: 10,
  sitInApproval: true,
  rakePercentage: 2.99,
  rakeCap: 4.99,
  buyInMin: 100,
  buyInMax: 1000,
  actionTime: 30,
  muckLosingHand: true,
  waitlistSittingTimeout: 5,
  rewardIds: [] as any,
};

describe('Agent Tips APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('agent tips test 1', async () => {
    // 1 configure a game
    // 2 start a game
    // 3 save hands from hands json file
    // 4 end game
    // 5 call aggregation api
    // 6 validate tips for each member
    const [clubCode, ownerId] = await clubutils.createClub('brady', 'yatzee');
    const playerIds = await createPlayers(clubCode, players);
    console.log(playerIds);
    // let the players join the club
    await createGameServer('1.99.1.1');
    await runGame(clubCode, ownerId, playersSeats, playerIds, holdemGameInput, 'hand-results/agents/game1.json');
    await runGame(clubCode, ownerId, playersSeats, playerIds, holdemGameInput, 'hand-results/agents/game2.json');
  })
});
