import {getNextHandInfo, moveToNextHand, PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase, getClient} from './utils/utils';
import * as handutils from './utils/hand.testutils';
import * as clubutils from './utils/club.testutils';
import * as gameutils from './utils/game.testutils';
import * as rewardutils from './utils/reward.testutils';
import {getLogger} from '../src/utils/log';
const logger = getLogger('hand-test');
import * as fs from 'fs';
import * as glob from 'glob';
import _ from 'lodash';
import {getRepository} from 'typeorm';
import {response} from 'express';
import { defaultHandData } from './utils/hand.testutils';
import { getGameSettings, updateGameSettings, updatePlayerGameSettings } from './utils/game.testutils';

const holdemGameInput = {
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
  buyInApproval: false,
  breakLength: 20,
  autoKickAfterBreak: true,
  waitForBigBlind: true,
  waitlistAllowed: true,
  maxWaitList: 10,
  sitInApproval: true,
  rakePercentage: 5.0,
  rakeCap: 5.0,
  buyInMin: 100,
  buyInMax: 600,
  actionTime: 30,
  bombPotEnabled: false,
  muckLosingHand: true,
  runItTwiceAllowed: false,
  rewardIds: [] as any,
};

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

async function createReward1(playerId, clubCode) {
  const rewardInput = {
    amount: 100,
    endHour: 4,
    minRank: 1,
    name: 'brady',
    startHour: 4,
    type: 'HIGH_HAND',
    schedule: 'HOURLY',
  };
  const rewardId = await getClient(playerId).mutate({
    variables: {
      clubCode: clubCode,
      input: rewardInput,
    },
    mutation: rewardutils.createReward,
  });
  holdemGameInput.rewardIds.splice(0);
  holdemGameInput.rewardIds.push(rewardId.data.rewardId);
  return rewardId.data.rewardId;
}

const SERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

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

async function setupGameEnvironment(
  owner: string,
  club: string,
  players: Array<string>,
  buyin: number,
  gameInput?: any,
): Promise<[string, number]> {

  if (!gameInput) {
    gameInput = holdemGameInput;
  }
  const gameServer = {
    ipAddress: '10.1.1.1',
    currentMemory: 100,
    status: 'ACTIVE',
    url: 'htto://localhost:8080',
  };
  try {
    await axios.post(`${SERVER_API}/register-game-server`, gameServer);
  } catch (err) {
    expect(true).toBeFalsy();
  }
  const game = await gameutils.configureGame(owner, club, gameInput);
  let i = 1;
  for await (const player of players) {
    await gameutils.joinGame(player, game.gameCode, i);
    await gameutils.buyin(player, game.gameCode, buyin);
    i++;
  }
  await gameutils.startGame(owner, game.gameCode);
  const gameId = await gameutils.getGameById(game.gameCode);
  return [game.gameCode, gameId];
}

describe('Game/Player Settings', () => {
  beforeEach(async done => {
    await resetDatabase();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('get game settings', async () => {
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
    const [gameCode, gameId] = await setupGameEnvironment(
      owner,
      clubCode,
      playerUuids,
      100
    );

    const gameSettings = await getGameSettings(owner, gameCode);
    expect(gameSettings).not.toBeNull();
    expect(gameSettings.allowRabbitHunt).toEqual(true);
    expect(gameSettings.bombPotBet).toEqual(5);
    expect(gameSettings.bombPotEnabled).toBeFalsy();
    expect(gameSettings.bombPotInterval).toEqual(30);
    expect(gameSettings.breakAllowed).toEqual(false);
    expect(gameSettings.breakLength).toEqual(20);
    expect(gameSettings.buyInApproval).toEqual(true);
    expect(gameSettings.doubleBoardBombPot).toEqual(false);
    expect(gameSettings.doubleBoardEveryHand).toEqual(false);
    expect(gameSettings.gpsCheck).toEqual(false);
    expect(gameSettings.ipCheck).toEqual(false);
    expect(gameSettings.runItTwiceAllowed).toEqual(false);
    expect(gameSettings.seatChangeAllowed).toEqual(true);
    expect(gameSettings.seatChangeTimeout).toEqual(30);
    expect(gameSettings.showHandRank).toEqual(false);
    expect(gameSettings.waitlistAllowed).toEqual(true);
    expect(gameSettings.waitlistSittingTimeout).toEqual(3);
  });


  test('update game settings', async () => {
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
    const [gameCode, gameId] = await setupGameEnvironment(
      owner,
      clubCode,
      playerUuids,
      100
    );
    const settings = {
      allowRabbitHunt: false,
      bombPotEnabled: true,
      bombPotEveryHand: true,
    };
    const ret = await updateGameSettings(owner, gameCode, settings);
    expect(ret).toBeTruthy();
    const gameSettings = await getGameSettings(owner, gameCode);
    expect(gameSettings).not.toBeNull();
    expect(gameSettings.allowRabbitHunt).toEqual(false);
    expect(gameSettings.bombPotBet).toEqual(5);
    expect(gameSettings.bombPotEnabled).toBeTruthy();
    expect(gameSettings.bombPotEveryHand).toBeTruthy();

    // move to next hand
    await moveToNextHand(gameId, gameCode, 0);
    const nextHand = await getNextHandInfo(gameCode);
    expect(nextHand.bombPot).toBeTruthy();
    expect(nextHand.bombPotBet).toEqual(5);
    expect(nextHand.buttonPos).toEqual(1);
    expect(nextHand.sbPos).toEqual(2);
    expect(nextHand.bbPos).toEqual(3);
    console.log(JSON.stringify(nextHand));
  });

  /**
   * Game is configured with bomb pot and run it twice
   * Player is configured not to participate in the bomb pot and run it twice
   */
  test('update player settings', async () => {
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);

    const gameInput = _.assign({}, holdemGameInput);
    gameInput.runItTwiceAllowed = true;
    gameInput.bombPotEnabled = true;

    const [gameCode, gameId] = await setupGameEnvironment(
      owner,
      clubCode,
      playerUuids,
      100,
      gameInput
    );
    const gameSettings = {
      allowRabbitHunt: false,
      bombPotEnabled: true,
      bombPotEveryHand: true,
    };
    await updateGameSettings(owner, gameCode, gameSettings);

    // disable bombpot and run it twice for the player
    let johnSettings: any = {
      bombPotEnabled: false,
      runItTwiceEnabled: false,
    };
    // john is not playing the hand
    let ret = await updatePlayerGameSettings('abc1235', gameCode, johnSettings);
    expect(ret).toBeTruthy();


    // player_3 settings
    let player3Settings: any = {
      runItTwiceEnabled: false,
      autoStraddle: true,
      buttonStraddle: true,
      muckLosingHand: true,
    };
    ret = await updatePlayerGameSettings(
      'abc123456',
      gameCode,
      player3Settings
    );
    expect(ret).toBeTruthy();

    // move to next hand
    await moveToNextHand(gameId, gameCode, 0);
    let nextHand = await getNextHandInfo(gameCode);
    expect(nextHand.bombPot).toBeTruthy();
    expect(nextHand.bombPotBet).toEqual(5);

    let playersInSeats = _.filter(
      nextHand.playersInSeats,
      e => e.openSeat === false
    );
    let playersInSeatsBySeatNo = _.keyBy(playersInSeats, 'seatNo');
    expect(playersInSeatsBySeatNo[1].inhand).toBeTruthy();
    expect(playersInSeatsBySeatNo[2].inhand).toBeTruthy();
    expect(playersInSeatsBySeatNo[3].inhand).toBeFalsy();

    // check player3 settings
    let player3 = playersInSeatsBySeatNo[2];
    expect(player3.runItTwice).toBeFalsy();
    expect(player3.autoStraddle).toBeTruthy();
    expect(player3.buttonStraddle).toBeTruthy();
    expect(player3.muckLosingHand).toBeTruthy();

    //console.log(JSON.stringify(nextHand));

    // enable bombpot for john again
    johnSettings = {
      bombPotEnabled: true,
    };
    ret = await updatePlayerGameSettings('abc1235', gameCode, johnSettings);
    expect(ret).toBeTruthy();

    player3Settings = {
      runItTwiceEnabled: true,
      autoStraddle: true,
      buttonStraddle: false,
      muckLosingHand: false,
    };
    ret = await updatePlayerGameSettings(
      'abc123456',
      gameCode,
      player3Settings
    );
    expect(ret).toBeTruthy();

    await moveToNextHand(gameId, gameCode, 1);
    nextHand = await getNextHandInfo(gameCode);
    expect(nextHand.bombPot).toBeTruthy();
    expect(nextHand.bombPotBet).toEqual(5);

    playersInSeats = _.filter(
      nextHand.playersInSeats,
      e => e.openSeat === false
    );
    playersInSeatsBySeatNo = _.keyBy(playersInSeats, 'seatNo');
    expect(playersInSeatsBySeatNo[1].inhand).toBeTruthy();
    expect(playersInSeatsBySeatNo[2].inhand).toBeTruthy();
    // john is playing this hand
    expect(playersInSeatsBySeatNo[3].inhand).toBeTruthy();

    player3 = playersInSeatsBySeatNo[2];
    expect(player3.runItTwice).toBeTruthy();
    expect(player3.autoStraddle).toBeTruthy();
    expect(player3.buttonStraddle).toBeFalsy();
    expect(player3.muckLosingHand).toBeFalsy();
  });
});
