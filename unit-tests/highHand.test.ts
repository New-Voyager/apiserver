import {initializeSqlLite} from './utils';
import {getLogger} from '../src/utils/log';
import {resetDB} from '../src/resolvers/reset';
import {createPlayer, getPlayerById} from '../src/resolvers/player';
import {createClub, joinClub, approveMember} from '../src/resolvers/club';
import {createGameServer} from '../src/internal/gameserver';
import {configureGame, joinGame} from '../src/resolvers/game';
import {
  saveReward,
  getHighHandWinners,
  getRewardTrack,
} from '../src/resolvers/reward';
import {postHand} from '../src/internal/hand';
import _ from 'lodash';

import {
  getHighHandsByGame,
  getHighHandsByReward,
} from '../src/resolvers/reward';
import * as fs from 'fs';
import * as glob from 'glob';

const logger = getLogger('High-hand unit-test');

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

beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

let rewardId;

async function createReward(playerId, clubCode) {
  const rewardInput = {
    amount: 100.4,
    endHour: 4,
    minRank: 1,
    name: 'brady',
    startHour: 4,
    type: 'HIGH_HAND',
    schedule: 'HOURLY',
  };
  rewardId = await saveReward(playerId, clubCode, rewardInput);
  holdemGameInput.rewardIds.splice(0);
  holdemGameInput.rewardIds.push(rewardId);
}

async function createClubWithMembers(
  ownerInput: any,
  clubInput: any,
  players: Array<any>
): Promise<[string, string, Array<string>, number, string, Array<number>]> {
  const gameServer = {
    ipAddress: '10.1.1.1',
    currentMemory: 100,
    status: 'ACTIVE',
    url: 'htto://localhost:8080',
  };
  let i = 0;
  await createGameServer(gameServer);
  const ownerUuid = await createPlayer({player: ownerInput});
  clubInput.ownerUuid = ownerUuid;
  const clubCode = await createClub(ownerUuid, clubInput);
  await createReward(ownerUuid, clubCode);
  const game = await configureGame(ownerUuid, clubCode, holdemGameInput);
  const playerUuids = new Array<string>();
  const playerIds = new Array<number>();
  for await (const playerInput of players) {
    const playerUuid = await createPlayer({player: playerInput});
    await joinClub(playerUuid, clubCode);
    await approveMember(ownerUuid, clubCode, playerUuid);
    const playerId = (await getPlayerById(playerUuid)).id;
    await joinGame(playerUuid, game.gameCode, ++i);
    playerUuids.push(playerUuid);
    playerIds.push(playerId);
  }
  return [ownerUuid, clubCode, playerUuids, game.id, game.gameCode, playerIds];
}

describe('HighHand APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('Save and retreive highHands', async () => {
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
        name: 'player_name2',
        deviceId: 'abc5678',
      },
      {
        name: 'player_name3',
        deviceId: 'abc4567',
      },
    ];

    const [
      ownerUuid,
      clubCode,
      playerUuids,
      gameId,
      gameCode,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);

    const files = await glob.sync('**/*.json', {
      onlyFiles: false,
      cwd: 'highhand-results',
      deep: 5,
    });
    const wonRank = [] as any,
      wonId = [] as any;
    const rewardTrackId = await getRewardTrack(
      playerUuids[0],
      gameCode,
      rewardId.toString()
    );
    for await (const file of files) {
      const obj = await fs.readFileSync(`highhand-results/${file}`, 'utf8');
      const data = JSON.parse(obj);
      data.gameId = gameId.toString();
      data.rewardTrackingIds.splice(0);
      data.rewardTrackingIds.push(rewardTrackId[0].id);
      data.players['1'].id = playerIds[0].toString();

      data.gameId = gameId.toString();
      data.players['2'].id = playerIds[1].toString();

      data.gameId = gameId.toString();
      data.players['3'].id = playerIds[2].toString();

      const rank: number[] = [];
      Object.keys(data.players).forEach(async card => {
        rank.push(parseInt(data.players[card.toString()].hhRank));
      });
      const highHandRank = _.min(rank);
      wonRank.push(highHandRank);
      for await (const seatNo of Object.keys(data.players)) {
        const player = data.players[seatNo];
        if (player.rank === highHandRank) {
          wonId.push(player.id);
        }
      }
      await postHand(gameId, data.handNum, data);
    }
    const resp1 = await getHighHandsByGame(
      ownerUuid.toString(),
      gameCode.toString()
    );
    const resRank = [] as any,
      resId = [] as any;
    for await (const logData of resp1) {
      resRank.push(logData.rank);
      const id = await getPlayerById(logData.playerUuid);
      resId.push(id.id.toString());
    }

    expect(resp1).not.toBeNull();
    expect(resp1.length).toEqual(files.length);
    expect(resRank).toEqual(expect.arrayContaining(wonRank));
    expect(resId).toEqual(expect.arrayContaining(wonId));
    const resp2 = await getHighHandsByReward(
      ownerUuid.toString(),
      gameCode.toString(),
      rewardId.toString()
    );
    const resByRewardRank = [] as any,
      resByRewardId = [] as any;
    for await (const logData of resp2) {
      resByRewardRank.push(logData.rank);
      const id = await getPlayerById(logData.playerUuid);
      resByRewardId.push(id.id.toString());
    }
    expect(resp2).not.toBeNull();
    expect(resp2.length).toEqual(files.length);
    expect(resByRewardRank).toEqual(expect.arrayContaining(wonRank));
    expect(resByRewardId).toEqual(expect.arrayContaining(wonId));

    const resp3 = await getHighHandWinners(
      ownerUuid.toString(),
      gameCode.toString(),
      rewardId.toString()
    );
    const resWinnerRank = [] as any,
      resWinnerId = [] as any;
    for await (const logData of resp3) {
      resWinnerRank.push(logData.rank);
      const id = await getPlayerById(logData.playerUuid);
      resWinnerId.push(id.id.toString());
    }
    expect(resp3).not.toBeNull();
    expect(resWinnerRank[0]).toEqual(_.min(wonRank));
  });
});
