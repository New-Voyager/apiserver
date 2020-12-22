import {PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase, getClient} from './utils/utils';
import * as handutils from './utils/hand.testutils';
import * as clubutils from './utils/club.testutils';
import * as gameutils from './utils/game.testutils';
import * as rewardutils from './utils/reward.testutils';
import * as fs from 'fs';
import * as glob from 'glob';
import _ from 'lodash';

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
  buyInApproval: true,
  breakLength: 20,
  autoKickAfterBreak: true,
  waitForBigBlind: true,
  waitlistSupported: true,
  maxWaitList: 10,
  sitInApproval: true,
  rakePercentage: 5.0,
  rakeCap: 5.0,
  buyInMin: 100,
  buyInMax: 600,
  actionTime: 30,
  muckLosingHand: true,
  rewardIds: [] as any,
};

let rewardId;

async function saveReward(playerId, clubCode) {
  const rewardInput = {
    amount: 100.4,
    endHour: 4,
    minRank: 1,
    name: 'brady',
    startHour: 4,
    type: 'HIGH_HAND',
    schedule: 'HOURLY',
  };
  rewardId = await getClient(playerId).mutate({
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

async function createGameServer(ipAddress: string) {
  const gameServer1 = {
    ipAddress: ipAddress,
    currentMemory: 100,
    status: 'ACTIVE',
  };
  try {
    await axios.post(`${SERVER_API}/register-game-server`, gameServer1);
  } catch (err) {
    expect(true).toBeFalsy();
  }
}

async function createClubAndStartGame(): Promise<
  [number, number, number, string, string, string, number]
> {
  const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
  const player = await handutils.getPlayerById(playerId);
  await createGameServer('1.2.0.1');

  const rewardId = await saveReward(playerId, clubCode);

  const game1 = await gameutils.configureGame(
    playerId,
    clubCode,
    holdemGameInput
  );
  const clubID = await clubutils.getClubById(clubCode);
  const gameID = await gameutils.getGameById(game1.gameCode);

  return [clubID, player, gameID, playerId, clubCode, game1.gameCode, rewardId];
}

describe('Hand Server', () => {
  beforeEach(async done => {
    await resetDatabase();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('Get logged data by game', async () => {
    const [
      clubId,
      playerId,
      gameId,
      player,
      clubCode,
      gameCode,
      rewardId,
    ] = await createClubAndStartGame();

    const playerUuid2 = await clubutils.createPlayer('adam', 'dev1');
    const playerId2 = await handutils.getPlayerById(playerUuid2);
    const playerUuid3 = await clubutils.createPlayer('ajay', 'device2');
    const playerId3 = await handutils.getPlayerById(playerUuid3);
    const files = await glob.sync('**/*.json', {
      onlyFiles: false,
      cwd: 'highhand-results',
      deep: 5,
    });
    const wonRank = [] as any,
      wonId = [] as any;
    for await (const file of files) {
      const obj = await fs.readFileSync(`highhand-results/${file}`, 'utf8');
      const data = JSON.parse(obj);

      data.handNum = 1;
      data.gameId = gameId.toString();
      data.rewardTrackingIds.splice(0);
      data.rewardTrackingIds.push(rewardId);
      data.players['1'].id = playerId.toString();

      data.gameId = gameId.toString();
      data.players['2'].id = playerId2.toString();

      data.gameId = gameId.toString();
      data.players['3'].id = playerId3.toString();

      const rank: number[] = [];
      Object.keys(data.players).forEach(async card => {
        rank.push(parseInt(data.players[card.toString()].rank));
      });
      const highHandRank = _.min(rank);
      wonRank.push(highHandRank);
      for await (const seatNo of Object.keys(data.players)) {
        const player = data.players[seatNo];
        if (player.rank === highHandRank) {
          wonId.push(player.id);
        }
      }
      const resp = await axios.post(
        `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
        data
      );
      expect(resp.data.status).toBe('OK');
    }

    const resp1 = await rewardutils.getlogDatabyGame(
      playerId.toString(),
      gameCode.toString()
    );
    const resRank = [] as any,
      resId = [] as any;
    for await (const logData of resp1) {
      resRank.push(logData.rank);
      const id = await handutils.getPlayerById(logData.playerUuid);
      resId.push(id.toString());
    }
    expect(resp1).not.toBeNull();
    expect(resp1.length).toEqual(files.length);
    expect(resRank).toEqual(expect.arrayContaining(wonRank));
    expect(resId).toEqual(expect.arrayContaining(wonId));

    const resp2 = await rewardutils.getlogDatabyReward(
      playerId.toString(),
      gameCode.toString(),
      rewardId.toString()
    );
    const resByRewardRank = [] as any,
      resByRewardId = [] as any;
    for await (const logData of resp2) {
      resByRewardRank.push(logData.rank);
      const id = await handutils.getPlayerById(logData.playerUuid);
      resByRewardId.push(id.toString());
    }
    expect(resp2).not.toBeNull();
    expect(resp2.length).toEqual(files.length);
    expect(resByRewardRank).toEqual(expect.arrayContaining(wonRank));
    expect(resByRewardId).toEqual(expect.arrayContaining(wonId));

    const resp3 = await rewardutils.getHighHandWinners(
      playerId.toString(),
      gameCode.toString(),
      rewardId.toString()
    );
    const resWinnerRank = [] as any,
      resWinnerId = [] as any;
    for await (const logData of resp3) {
      resWinnerRank.push(logData.rank);
      const id = await handutils.getPlayerById(logData.playerUuid);
      resWinnerId.push(id.toString());
    }
    expect(resp3).not.toBeNull();
    expect(resWinnerRank[0]).toEqual(_.min(wonRank));
  });
});
