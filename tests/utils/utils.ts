import {default as ApolloClient} from 'apollo-boost';
import axios from 'axios';
import {execute, gql, HttpLink, toPromise} from 'apollo-boost';
import {start} from '../../src/server';
import * as gameutils from './game.testutils';
import * as clubutils from './club.testutils';
import * as handutils from './hand.testutils';
import fetch from 'node-fetch'
import { buyIn, configureGame, getPlayerById, joinGame, startGame } from '../game/utils';
import { endGame, gameResult, getGameById } from './game.testutils';
import fs from 'fs';
import _ from 'lodash';
export const EXTERNAL_PORT = 9501;
export const INTERNAL_PORT = 9502;
const SERVER_API = `http://localhost:${INTERNAL_PORT}/internal`;

export function getClient(token?: string): any {
  return new ApolloClient({
    fetch: fetch,
    uri: `http://localhost:${EXTERNAL_PORT}/graphql`,
    request: operation => {
      if (token) {
        operation.setContext({
          userIp: 1,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    },
  });
}

export async function resetDatabase() {
  const client = getClient('TEST_USER',);
  const resetDB = gql`
    mutation {
      resetDB
    }
  `;
  const resp = await client.mutate({
    mutation: resetDB,
  });
  console.log(`Reset DB: ${resp.resetDB}`);
}

export async function runLivenessProbe() {
  const url = `http://localhost:${INTERNAL_PORT}/internal/alive`;
  try {
    const start = Date.now()
    const resp = await axios.get(url, {timeout: 3000});
    const end = Date.now()
    console.info(`Liveness probe took ${end - start} ms`);
    if (resp.status != 200) {
      throw new Error(`Received http status ${resp.status}`);
    }
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export async function moveToNextHand(
  gameId: number,
  gameCode: string,
  handNum: number
) {
  const url = `http://localhost:${INTERNAL_PORT}/internal/move-to-next-hand/game_num/${gameCode}/hand_num/${handNum}`;
  try {
    await axios.post(url);
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export async function anyPendingUpdates(
  gameId: number,
) {
  const url = `http://localhost:${INTERNAL_PORT}/internal/any-pending-updates/gameId/${gameId}`;
  try {
    const resp = await axios.get(url);
    return resp.data['pendingUpdates'];
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export async function processPendingUpdates(
  gameId: number,
) {
  const url = `http://localhost:${INTERNAL_PORT}/internal/process-pending-updates/gameId/${gameId}`;
  try {
    await axios.post(url);
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export async function getNextHandInfo(gameCode: string) {
  const url = `http://localhost:${INTERNAL_PORT}/internal/next-hand-info/game_num/${gameCode}`;
  try {
    const resp = await axios.get(url);
    return resp.data;
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export async function signup(name: string, playerId: string): Promise<any> {
  const url = `http://localhost:${EXTERNAL_PORT}/auth/signup`;
  try {
    const payload = {
      'screen-name': name,
      'device-id': playerId,
    };
    const resp = await axios.post(url, payload);
    return resp.data;
  } catch (err) {
    console.error(JSON.stringify(err));
    expect(true).toBeFalsy();
  }
}

export async function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export async function getClubs(playerId: string) {
  console.log('In getClubs');
  await resetDatabase();

  const client = getClient(playerId);

  const hello = gql`
    query {
      hello
    }
  `;
  const resp = await client.query({
    query: hello,
  });
  console.log(JSON.stringify(resp));
}

export const startGqlServer = async () => {
  const [externalServer, internalServer, apollo]= await start(false, {intTest: true});

  const link = new HttpLink({
    uri: `http://localhost:${EXTERNAL_PORT}/graphql`,
    fetch,
  });

  const executeOperation = ({query, variables = {}}) =>
    execute(link, {query, variables});

  return {
    link,
    stop: () => {
      externalServer.close();
      internalServer.close();
    },
    graphql: executeOperation,
  };
};

export async function setupGameEnvironment(
  gameServerUrl: string,
  owner: string,
  club: string,
  players: Array<string>,
  holdemGameInput: any,
): Promise<[string, number]> {
  const gameServer = {
    ipAddress: '10.1.1.1',
    currentMemory: 100,
    status: 'ACTIVE',
    url: 'htto://localhost:8080',
  };
  try {
    await axios.post(`${gameServerUrl}/register-game-server`, gameServer);
  } catch (err) {
    expect(true).toBeFalsy();
  }
  const game = await gameutils.configureGame(owner, club, holdemGameInput);
  let i = 1;
  for await (const player of players) {
    await gameutils.joinGame(player, game.gameCode, i);
    //  await chipstrackutils.buyIn(player, game.gameCode, buyin);
    i++;
  }

  await startGame({ownerId: owner, gameCode: game.gameCode});

  const gameId = await gameutils.getGameById(game.gameCode);
  return [game.gameCode, gameId];
}

export async function createClubWithMembers(
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


export async function runGame(clubCode: string, ownerId: string, playersSeats: any, playerIds: any, gameInput: any, handsFile: string) {
  const resp = await configureGame({gameInput, clubCode, playerId: ownerId});
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
  // end game
  await endGame(ownerId, gameCode)

  // aggregate results
  await axios.post(`http://localhost:${INTERNAL_PORT}/admin/post-process-games`)
  console.log('Post processing done');

}

async function processHands(ownerId: string, gameId: number, gameCode: string, playerIds: any, playersSeats: any, filename: string) {
  const hands = JSON.parse(fs.readFileSync(filename, { encoding: 'utf-8' }));

  // build a map with seatno->playername
  const playerInSeats = {};
  for(const player of Object.keys(playersSeats)) {
    const seatNo = playersSeats[player];
    playerInSeats[seatNo] = player;
  }
  const sortedHands = _.sortBy(hands, [function(o) { return o.handNum; }]);
  let totalTipsCollected = 0;
  let handNum = 0;
  for(const hand of sortedHands) {
    const handData = hand.data;
    totalTipsCollected += handData.result.tipsCollected;
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
    await axios.post(`${SERVER_API}/save-hand/gameId/${gameId}/handNum/${handData.handNum}`, handData);
  }
  console.log(`Tips collected: ${totalTipsCollected}`);
  const result = await gameResult(ownerId, gameCode);
  let totalBuyIn = 0;
  let totalRake = 0;
  let totalStack = 0;
  for (const player of result) {
    totalBuyIn += player.buyIn;
    totalStack += player.stack;
    totalRake += player.rakePaid;
  }
  expect(totalBuyIn.toPrecision(2)).toEqual((totalStack+totalRake).toPrecision(2));
  console.log(JSON.stringify(hands));

}

export async function createPlayers(clubCode: string, players: Array<string>): Promise<any> {
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