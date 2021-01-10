import {PORT_NUMBER} from './utils/utils';
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
  buyin: number
): Promise<[string, number]> {
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
  const game = await gameutils.configureGame(owner, club, holdemGameInput);
  let i = 1;
  for await (const player of players) {
    await gameutils.joinGame(player, game.gameCode, i);
    //  await chipstrackutils.buyIn(player, game.gameCode, buyin);
    i++;
  }
  await gameutils.startGame(owner, game.gameCode);
  const gameId = await gameutils.getGameById(game.gameCode);
  return [game.gameCode, gameId];
}

async function defaultHandData(
  file: string,
  gameId: number,
  rewardId: any,
  playerIds: Array<number>
) {
  const obj = await fs.readFileSync(`highhand-results/${file}`, 'utf8');
  const data = JSON.parse(obj);
  data.gameId = gameId.toString();
  data.rewardTrackingIds.splice(0);
  data.rewardTrackingIds.push(rewardId);
  data.players['1'].id = playerIds[0].toString();

  data.gameId = gameId.toString();
  data.players['2'].id = playerIds[1].toString();

  data.gameId = gameId.toString();
  data.players['3'].id = playerIds[2].toString();
  return data;
}

describe('Hand Server', () => {
  beforeEach(async done => {
    await resetDatabase();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('Save hand data', async () => {
    try {
      const [
        owner,
        clubCode,
        clubId,
        playerUuids,
        playerIds,
      ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
      const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        owner,
        clubCode,
        playerUuids,
        100
      );
      const rewardTrackId = await rewardutils.getRewardtrack(
        playerUuids[0],
        gameCode,
        rewardId.toString()
      );
      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'highhand-results',
        deep: 5,
      });

      for await (const file of files) {
        const data = await defaultHandData(
          file,
          gameId,
          rewardTrackId,
          playerIds
        );
        const resp = await axios.post(
          `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
          data
        );
        expect(resp.status).toBe(200);
      }
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test.skip('Get specific hand history', async () => {
    try {
      const [
        owner,
        clubCode,
        clubId,
        playerUuids,
        playerIds,
      ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
      const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        owner,
        clubCode,
        playerUuids,
        100
      );
      const rewardTrackId = await rewardutils.getRewardtrack(
        playerUuids[0],
        gameCode,
        rewardId.toString()
      );
      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'highhand-results',
        deep: 5,
      });

      for await (const file of files) {
        const data = await defaultHandData(
          file,
          gameId,
          rewardTrackId,
          playerIds
        );
        await axios.post(
          `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
          data
        );
      }
      const handHistory = await handutils.getSpecificHandHistory(
        playerUuids[0],
        clubCode,
        gameCode,
        '1'
      );
      expect(handHistory.gameType).toBe('HOLDEM');
      expect(handHistory.gameId).toBe(gameId);
      expect(handHistory.handNum).toBe(1);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test.skip('Get latest hand history', async () => {
    try {
      const [
        owner,
        clubCode,
        clubId,
        playerUuids,
        playerIds,
      ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
      const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        owner,
        clubCode,
        playerUuids,
        100
      );
      const rewardTrackId = await rewardutils.getRewardtrack(
        playerUuids[0],
        gameCode,
        rewardId.toString()
      );

      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'highhand-results',
        deep: 5,
      });

      let lastHand = 0;
      for await (const file of files) {
        const data = await defaultHandData(
          file,
          gameId,
          rewardTrackId,
          playerIds
        );
        await axios.post(
          `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
          data
        );
        lastHand += 1;
      }
      const resp1 = await handutils.getLastHandHistory(
        playerUuids[0],
        clubCode,
        gameCode
      );
      expect(resp1.gameType).toBe('HOLDEM');
      expect(resp1.wonAt).toBe('SHOW_DOWN');
      expect(resp1.handNum).toBe(lastHand);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get all hand history', async () => {
    try {
      const [
        owner,
        clubCode,
        clubId,
        playerUuids,
        playerIds,
      ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
      const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        owner,
        clubCode,
        playerUuids,
        100
      );
      const rewardTrackId = await rewardutils.getRewardtrack(
        playerUuids[0],
        gameCode,
        rewardId.toString()
      );

      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'highhand-results',
        deep: 5,
      });

      let lastHand = 0;
      for await (const file of files) {
        const data = await defaultHandData(
          file,
          gameId,
          rewardTrackId,
          playerIds
        );
        const resp = await axios.post(
          `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
          data
        );
        expect(resp.status).toBe(200);
        lastHand += 1;
      }
      const handHistory = await handutils.getAllHandHistory(
        playerUuids[0],
        clubCode,
        gameCode
      );
      expect(handHistory).toHaveLength(lastHand);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get all hand history pagination', async () => {
    try {
      const [
        owner,
        clubCode,
        clubId,
        playerUuids,
        playerIds,
      ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
      const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        owner,
        clubCode,
        playerUuids,
        100
      );
      const rewardTrackId = await rewardutils.getRewardtrack(
        playerUuids[0],
        gameCode,
        rewardId.toString()
      );

      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'highhand-results',
        deep: 5,
      });

      let lastHand = 0;
      for await (const file of files) {
        const data = await defaultHandData(
          file,
          gameId,
          rewardTrackId,
          playerIds
        );
        await axios.post(
          `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
          data
        );
        lastHand += 1;
      }

      const handHistory = await handutils.getAllHandHistory(
        playerUuids[0],
        clubCode,
        gameCode,
        {
          count: lastHand - 2,
        }
      );
      expect(handHistory).toHaveLength(lastHand - 2);
      const handHistory1 = await handutils.getAllHandHistory(
        playerUuids[0],
        clubCode,
        gameCode,
        {
          prev: handHistory[lastHand - 3].pageId,
          count: 2,
        }
      );
      expect(handHistory1).toHaveLength(2);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test.skip('Get my winning hands', async () => {
    try {
      const [
        owner,
        clubCode,
        clubId,
        playerUuids,
        playerIds,
      ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
      const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        owner,
        clubCode,
        playerUuids,
        100
      );
      const rewardTrackId = await rewardutils.getRewardtrack(
        playerUuids[0],
        gameCode,
        rewardId.toString()
      );

      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'highhand-results',
        deep: 5,
      });

      let noOfWinningPlayer2 = 0;
      for await (const file of files) {
        const data = await defaultHandData(
          file,
          gameId,
          rewardTrackId,
          playerIds
        );
        const resp = await axios.post(
          `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
          data
        );
        expect(resp.status).toBe(200);
        for await (const hiWinner of data.handLog.potWinners[0].hiWinners) {
          if (data.players[hiWinner.seatNo].id == playerIds[1])
            noOfWinningPlayer2 += 1;
        }
        for await (const loWinner of data.handLog.potWinners[0].lowWinners) {
          if (data.players[loWinner.seatNo].id == playerIds[1])
            noOfWinningPlayer2 += 1;
        }
      }
      console.log(noOfWinningPlayer2);
      const winningHands = await handutils.getMyWinningHands(
        playerUuids[0],
        clubCode,
        gameCode
      );
      console.log(winningHands);
      // expect(winningHands).toHaveLength(4);
      // winningHands.forEach(element => {
      //   expect(element.playerId).toBe(playerId);
      // });
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test.skip('Get my winning hands pagination', async () => {
    try {
      const [
        owner,
        clubCode,
        clubId,
        playerUuids,
        playerIds,
      ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
      const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        owner,
        clubCode,
        playerUuids,
        100
      );
      const rewardTrackId = await rewardutils.getRewardtrack(
        playerUuids[0],
        gameCode,
        rewardId.toString()
      );

      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'highhand-results',
        deep: 5,
      });

      let noOfWinningPlayer2 = 0;
      for await (const file of files) {
        const data = await defaultHandData(
          file,
          gameId,
          rewardTrackId,
          playerIds
        );
        const resp = await axios.post(
          `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
          data
        );
        expect(resp).toBe(true);
        for await (const hiWinner of data.handLog.potWinners[0].hiWinners) {
          if (data.players[hiWinner.seatNo].id == playerIds[1])
            noOfWinningPlayer2 += 1;
        }
        for await (const loWinner of data.handLog.potWinners[0].lowWinners) {
          if (data.players[loWinner.seatNo].id == playerIds[1])
            noOfWinningPlayer2 += 1;
        }
      }
      console.log(noOfWinningPlayer2);
      const winningHands = await handutils.getMyWinningHands(
        playerUuids[0],
        clubCode,
        gameCode,
        {
          count: noOfWinningPlayer2 - 1,
        }
      );
      const winningHands1 = await handutils.getMyWinningHands(
        playerUuids[0],
        clubCode,
        gameCode,
        {
          prev: winningHands[noOfWinningPlayer2 - 2].pageId,
          count: 3,
        }
      );
      console.log(winningHands, winningHands1);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test.skip('Save starred hand', async () => {
    try {
      const [
        owner,
        clubCode,
        clubId,
        playerUuids,
        playerIds,
      ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
      const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        owner,
        clubCode,
        playerUuids,
        100
      );
      const rewardTrackId = await rewardutils.getRewardtrack(
        playerUuids[0],
        gameCode,
        rewardId.toString()
      );

      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'highhand-results',
        deep: 5,
      });

      let lastHand = 0;
      for await (const file of files) {
        const data = await defaultHandData(
          file,
          gameId,
          rewardTrackId,
          playerIds
        );
        await axios.post(
          `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
          data
        );
        lastHand += 1;
      }

      const starredHand = await handutils.saveStarredHand(
        clubCode,
        gameCode,
        playerUuids[0],
        '1'
      );
      expect(starredHand).toBe('true');
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test.skip('Get starred hand', async () => {
    try {
      const [
        owner,
        clubCode,
        clubId,
        playerUuids,
        playerIds,
      ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
      const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        owner,
        clubCode,
        playerUuids,
        100
      );
      const rewardTrackId = await rewardutils.getRewardtrack(
        playerUuids[0],
        gameCode,
        rewardId.toString()
      );

      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'highhand-results',
        deep: 5,
      });

      let lastHand = 0;
      for await (const file of files) {
        const data = await defaultHandData(
          file,
          gameId,
          rewardTrackId,
          playerIds
        );
        const resp = await axios.post(
          `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
          data
        );
        expect(resp.status).toBe(200);
        await handutils.saveStarredHand(
          clubCode,
          gameCode,
          playerUuids[0],
          data.handNum.toString()
        );
        lastHand += 1;
      }
      const starredHands = await handutils.getStarredHands(playerUuids[0]);
      expect(starredHands).toHaveLength(lastHand);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });
});
