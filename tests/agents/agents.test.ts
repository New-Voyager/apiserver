import {Cache} from '../../src/cache';
import {getClient, INTERNAL_PORT, resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {configureGameQuery, joinGame, buyIn, createGameServer,  getPlayerById,  takeSeat} from '../game/utils';
import fs from 'fs';
import axios from 'axios';
import { gameInfo, getGameById } from '../utils/game.testutils';
const SERVER_API = `http://localhost:${INTERNAL_PORT}/internal`;

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

export const configureGame = async ({playerId, clubCode, highHandTracked, gpsCheck, ipCheck}: any) => {
  const resp = await getClient(playerId).mutate({
    variables: {
      clubCode: clubCode,
      gameInput: { ...holdemGameInput, highHandTracked, gpsCheck, ipCheck },
    },
    mutation: configureGameQuery,
  });

  return resp;
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
    // 3 post hands from hands json file
    // 4 end game
    // 5 call aggregation api
    // 6 validate tips for each member
    const [clubCode, ownerId] = await clubutils.createClub('brady', 'yatzee');
    const playerIds = await createPlayers(clubCode, players);
    console.log(playerIds);
    // let the players join the club
    await createGameServer('1.99.1.1');
    await runGame(clubCode, ownerId, playerIds, 'hand-results/agents/game1.json');
  })
});

async function runGame(clubCode: string, ownerId: string, playerIds: any, handsFile: string) {
  const resp = await configureGame({clubCode, playerId: ownerId});
  const gameCode = resp.data.configuredGame.gameCode;
  const gameId = await getGameById(gameCode);
  // let the players join the game
  for(const player of Object.keys(playersSeats)) {
    const seatNo = playersSeats[player];
    const playerUuid = playerIds[player].uuid;
    await joinGame({
      ownerId: playerUuid,
      gameCode: gameCode,
      seatNo: seatNo,
      location: {
        lat: 100,
        long: 100,
      },
    });
    await buyIn({ownerId: playerUuid, gameCode: gameCode, amount: 600});
  }
  console.log(playerIds);
  await processHands(ownerId, gameId, gameCode, playerIds, playersSeats, handsFile)

}

async function processHands(ownerId: string, gameId: number, gameCode: string, playerIds: any, playersSeats: any, filename: string) {
  const hands = JSON.parse(fs.readFileSync(filename, { encoding: 'utf-8' }));

  // build a map with seatno->playername
  const playerInSeats = {};
  for(const player of Object.keys(playersSeats)) {
    const seatNo = playersSeats[player];
    playerInSeats[seatNo] = player;
  }
  for(const hand of hands) {
    const handData = hand.data;
    console.log(JSON.stringify(handData));
    for (const seatNo of Object.keys(playerInSeats)) {
      const playerName = playerInSeats[seatNo];
      const playerId = playerIds[playerName];
      if (!hand.data.result.playerInfo[seatNo]) {
        console.log('Player is not found in the seat');
      } else {
        hand.data.result.playerInfo[seatNo].id = playerId.id;
      }
    }

    handData.gameId = String(gameId);
    await axios.post(`${SERVER_API}/save-hand/gameId/${gameId}/handNum/${handData.handNum}`, handData)
    const rawData = await gameInfo(ownerId, gameCode)

    const finalStackData = rawData.seatInfo.playersInSeats;
    console.log(finalStackData);
  }

  console.log(JSON.stringify(hands));
}

async function createPlayers(clubCode: string, players: Array<string>): Promise<any> {
  const playerIds = {};
  for (const player of players) {
    const playerUuid = await clubutils.createPlayer(player, player);
    const playerID = await getPlayerById(playerUuid);
    await clubutils.playerJoinsClub(clubCode, playerUuid);
    playerIds[player] = {
      uuid: playerUuid,
      id: playerID,
    };
  }
  return playerIds;
}