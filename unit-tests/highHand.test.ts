import {initializeSqlLite} from './utils';
import {getLogger} from '../src/utils/log';
import {resetDB} from '../src/resolvers/reset';
import {createPlayer, getPlayerById} from '../src/resolvers/player';
import {createClub, getClubById} from '../src/resolvers/club';
import {getGame} from '../src/cache/index';
import {createGameServer} from '../src/internal/gameserver';
import {configureGame} from '../src/resolvers/game';
import {saveReward, getHighHandWinners} from '../src/resolvers/reward';
import {postHand} from '../src/internal/hand';
import _ from 'lodash';

import {
  getHighHandsByGame,
  getHighHandsByReward,
} from '../src/resolvers/reward';
import * as fs from 'fs';
import * as glob from 'glob';
import {
  getLastHandHistory,
  getSpecificHandHistory,
  getAllHandHistory,
  getMyWinningHands,
  getAllStarredHands,
  saveStarredHand,
} from '../src/resolvers/hand';

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

async function createClubAndStartGame(): Promise<
  [number, number, number, string, string, string]
> {
  const owner = await createPlayer({
    player: {
      name: 'player_name',
      deviceId: 'abc',
    },
  });
  expect(owner).not.toBeNull();
  const club = await createClub(owner, {
    name: 'club_name',
    description: 'poker players gather',
    ownerUuid: owner,
  });
  expect(club).not.toBeNull();
  const gameServer = {
    ipAddress: '10.1.1.1',
    currentMemory: 100,
    status: 'ACTIVE',
    url: 'htto://localhost:8080',
  };
  await createGameServer(gameServer);
  await createReward(owner, club);
  const game = await configureGame(owner, club, holdemGameInput);
  const playerId = (await getPlayerById(owner)).id;
  const gameId = (await getGame(game.gameCode)).id;
  const clubId = (await getClubById(owner, club)).id;
  return [clubId, playerId, gameId, owner, club, game.gameCode];
}

describe('HighHand APIs', () => {
  test('Save and retreive highHands', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createClubAndStartGame();

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

      const playerUuid2 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const playerId2 = await getPlayerById(playerUuid2);
      const playerUuid3 = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const playerId3 = await getPlayerById(playerUuid3);
      data.gameId = gameId.toString();
      data.players['2'].id = playerId2.id.toString();

      data.gameId = gameId.toString();
      data.players['3'].id = playerId3.id.toString();

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
      await postHand(gameId, data.handNum, data);
    }
    const resp1 = await getHighHandsByGame(
      playerId.toString(),
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
      playerId.toString(),
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
      playerId.toString(),
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
