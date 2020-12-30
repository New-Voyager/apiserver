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

let rewardId, rewardTrackID;

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
  rewardId = rewardId.data.rewardId;
}

const SERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

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
  try {
    await axios.post(`${SERVER_API}/register-game-server`, gameServer);
  } catch (err) {
    expect(true).toBeFalsy();
  }
  const [clubCode, ownerId] = await clubutils.createClub('brady', 'yatzee');
  await saveReward(ownerId, clubCode);
  const game = await gameutils.configureGame(
    ownerId,
    clubCode,
    holdemGameInput
  );
  const playerUuids = new Array<string>();
  const playerIds = new Array<number>();
  for await (const playerInput of players) {
    const playerUuid = await clubutils.createPlayer(
      playerInput.name,
      playerInput.deviceId
    );
    await clubutils.playerJoinsClub(clubCode, playerUuid);
    await clubutils.approvePlayer(clubCode, ownerId, playerUuid);
    const playerId = await handutils.getPlayerById(playerUuid);
    await gameutils.joinGame(playerUuid, game.gameCode, ++i);
    playerUuids.push(playerUuid);
    playerIds.push(playerId);
  }
  const gameId = await gameutils.getGameById(game.gameCode);
  rewardTrackID = await rewardutils.getRewardtrack(
    playerUuids[0],
    game.gameCode,
    rewardId.toString()
  );
  return [ownerId, clubCode, playerUuids, gameId, game.gameCode, playerIds];
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
    for await (const file of files) {
      const obj = await fs.readFileSync(`highhand-results/${file}`, 'utf8');
      const data = JSON.parse(obj);
      data.gameId = gameId.toString();
      data.rewardTrackingIds.splice(0);
      data.rewardTrackingIds.push(rewardTrackID);
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
        if (player.hhRank === highHandRank) {
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
      ownerUuid.toString(),
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
      ownerUuid.toString(),
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
      ownerUuid.toString(),
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
