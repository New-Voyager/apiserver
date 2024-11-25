import {createClubWithMembers, INTERNAL_PORT, setupGameEnvironment, startGqlServer} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase, getClient} from './utils/utils';
import * as handutils from './utils/hand.testutils';
import * as rewardutils from './utils/reward.testutils';
import {getLogger} from '../src/utils/log';
const logger = getLogger('hand-test');
import * as fs from 'fs';
import * as glob from 'glob';
import _ from 'lodash';
import {getRepository} from 'typeorm';
import {response} from 'express';
import {defaultHandData} from './utils/hand.testutils';
import {startGame} from './game/utils';

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
  waitlistAllowed: true,
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

const SERVER_API = `http://localhost:${INTERNAL_PORT}/internal`;

describe('Hand Tests', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });

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
      //const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        SERVER_API,
        owner,
        clubCode,
        playerUuids,
        holdemGameInput,
      );
      // const rewardTrackId = await rewardutils.getRewardtrack(
      //   playerUuids[0],
      //   gameCode,
      //   rewardId.toString()
      // );
      const directory = 'hand-results/app-coin';
      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'hand-results/app-coin',
        deep: 5,
      });

      for await (const file of files) {
        const filename = directory + '/' + file;
        const data = await defaultHandData(
          filename,
          gameId,
          //rewardTrackId,
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
    // try {
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
    //const rewardId = await createReward(owner, clubCode);
    const [gameCode, gameId] = await setupGameEnvironment(
      SERVER_API,
      owner,
      clubCode,
      playerUuids,
      holdemGameInput,
    );
    // const rewardTrackId = await rewardutils.getRewardtrack(
    //   playerUuids[0],
    //   gameCode,
    //   rewardId.toString()
    // );
    const directory = 'hand-results/app-coin';
    const files = await glob.sync('**/*.json', {
      onlyFiles: false,
      cwd: 'hand-results/app-coin',
      deep: 5,
    });

    for await (const file of files) {
      const filename = directory + '/' + file;
      const data = await defaultHandData(
        filename,
        gameId,
        //rewardTrackId,
        playerIds
      );
      await axios.post(
        `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
        data
      );
    }
    const handHistory = await handutils.getSpecificHandHistory(
      playerUuids[0],
      gameCode,
      1
    );
    expect(handHistory.gameType).toBe('HOLDEM');
    expect(handHistory.handNum).toBe(1);
    // } catch (err) {
    //   logger.error(JSON.stringify(err));
    //   expect(true).toBeFalsy();
    // }
  });

  test.skip('Get latest hand history', async () => {
    // try {
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
    //const rewardId = await createReward(owner, clubCode);
    const [gameCode, gameId] = await setupGameEnvironment(
      SERVER_API,
      owner,
      clubCode,
      playerUuids,
      holdemGameInput,
    );
    // const rewardTrackId = await rewardutils.getRewardtrack(
    //   playerUuids[0],
    //   gameCode,
    //   rewardId.toString()
    // );

    let lastHand = 0;

    const directory = 'hand-results/app-coin';
    const files = await glob.sync('**/*.json', {
      onlyFiles: false,
      cwd: 'hand-results/app-coin',
      deep: 5,
    });

    for await (const file of files) {
      const filename = directory + '/' + file;
      const data = await defaultHandData(
        filename,
        gameId,
        //rewardTrackId,
        playerIds
      );
      await axios.post(
        `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
        data
      );
      lastHand += 1;
    }
    const resp1 = await handutils.getLastHandHistory(playerUuids[0], gameCode);
    expect(resp1.gameType).toBe('HOLDEM');
    expect(resp1.wonAt).toBe('SHOW_DOWN');
    expect(resp1.handNum).toBe(lastHand);
    // } catch (err) {
    //   logger.error(JSON.stringify(err));
    //   expect(true).toBeFalsy();
    // }
  });

  test('Get all hand history', async () => {
    try {
      let nextHandNum = 1;
      const [
        owner,
        clubCode,
        clubId,
        playerUuids,
        playerIds,
      ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
      //const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        SERVER_API,
        owner,
        clubCode,
        playerUuids,
        holdemGameInput,
      );
      // const rewardTrackId = await rewardutils.getRewardtrack(
      //   playerUuids[0],
      //   gameCode,
      //   rewardId.toString()
      // );
      let lastHand = 0;
      const directory = 'hand-results/app-coin';
      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'hand-results/app-coin',
        deep: 5,
      });

      for await (const file of files) {
        const filename = directory + '/' + file;
        const data = await defaultHandData(
          filename,
          gameId,
          //rewardTrackId,
          playerIds
        );
        data.handNum = nextHandNum++;
        const resp = await axios.post(
          `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
          data
        );
        expect(resp.status).toBe(200);
        lastHand += 1;
      }
      const handHistory = await handutils.getAllHandHistory(
        playerUuids[0],
        gameCode
      );
      expect(handHistory).toHaveLength(lastHand);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test.skip('Get all hand history pagination', async () => {
    try {
      const [
        owner,
        clubCode,
        clubId,
        playerUuids,
        playerIds,
      ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
      //const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        SERVER_API,
        owner,
        clubCode,
        playerUuids,
        holdemGameInput,
      );
      // const rewardTrackId = await rewardutils.getRewardtrack(
      //   playerUuids[0],
      //   gameCode,
      //   rewardId.toString()
      // );

      let lastHand = 0;
      const directory = 'hand-results/app-coin';
      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'hand-results/app-coin',
        deep: 5,
      });

      for await (const file of files) {
        const filename = directory + '/' + file;
        const data = await defaultHandData(
          filename,
          gameId,
          //rewardTrackId,
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
        gameCode,
        {
          count: lastHand - 2,
        }
      );
      expect(handHistory).toHaveLength(lastHand - 2);
      const handHistory1 = await handutils.getAllHandHistory(
        playerUuids[0],
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
      //const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        SERVER_API,
        owner,
        clubCode,
        playerUuids,
        holdemGameInput,
      );
      // const rewardTrackId = await rewardutils.getRewardtrack(
      //   playerUuids[0],
      //   gameCode,
      //   rewardId.toString()
      // );

      let noOfWinningPlayer2 = 0;

      const directory = 'hand-results/app-coin';
      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'hand-results/app-coin',
        deep: 5,
      });

      for await (const file of files) {
        const filename = directory + '/' + file;
        const data = await defaultHandData(
          filename,
          gameId,
          //rewardTrackId,
          playerIds
        );

        const resp = await axios.post(
          `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
          data
        );
        expect(resp.status).toBe(200);
        for await (const hiWinner of data.handLog.potWinners[0].hiWinners) {
          if (data.players[hiWinner.seatNo].id === playerIds[1])
            noOfWinningPlayer2 += 1;
        }
        for await (const loWinner of data.handLog.potWinners[0].lowWinners) {
          if (data.players[loWinner.seatNo].id === playerIds[1])
            noOfWinningPlayer2 += 1;
        }
      }
      console.log(noOfWinningPlayer2);
      const winningHands = await handutils.getMyWinningHands(
        playerUuids[0],
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
      //const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        SERVER_API,
        owner,
        clubCode,
        playerUuids,
        holdemGameInput,
      );
      // const rewardTrackId = await rewardutils.getRewardtrack(
      //   playerUuids[0],
      //   gameCode,
      //   rewardId.toString()
      // );

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
          //rewardTrackId,
          playerIds
        );
        const resp = await axios.post(
          `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
          data
        );
        expect(resp).toBe(true);
        for await (const hiWinner of data.handLog.potWinners[0].hiWinners) {
          if (data.players[hiWinner.seatNo].id === playerIds[1])
            noOfWinningPlayer2 += 1;
        }
        for await (const loWinner of data.handLog.potWinners[0].lowWinners) {
          if (data.players[loWinner.seatNo].id === playerIds[1])
            noOfWinningPlayer2 += 1;
        }
      }
      console.log(noOfWinningPlayer2);
      const winningHands = await handutils.getMyWinningHands(
        playerUuids[0],
        gameCode,
        {
          count: noOfWinningPlayer2 - 1,
        }
      );
      const winningHands1 = await handutils.getMyWinningHands(
        playerUuids[0],
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

  test('Handtest: Share hands', async () => {
    try {
      const [
        owner,
        clubCode,
        clubId,
        playerUuids,
        playerIds,
      ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
      //const rewardId = await createReward(owner, clubCode);
      const [gameCode, gameId] = await setupGameEnvironment(
        SERVER_API,
        owner,
        clubCode,
        playerUuids,
        holdemGameInput,
      );
      // const rewardTrackId = await rewardutils.getRewardtrack(
      //   playerUuids[0],
      //   gameCode,
      //   rewardId.toString()
      // );
      let lastHand = 0;
      let id = 0;

      const directory = 'hand-results/app-coin';
      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'hand-results/app-coin',
        deep: 5,
      });

      for await (const file of files) {
        const filename = directory + '/' + file;
        const data = await defaultHandData(
          filename,
          gameId,
          //rewardTrackId,
          playerIds
        );
        const resp = await axios.post(
          `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
          data
        );
        expect(resp.status).toBe(200);
        id = await handutils.saveSharedHand(
          gameCode,
          playerUuids[0],
          data.handNum,
          clubCode
        );
        lastHand += 1;
      }

      const allSharedHands = await handutils.getsharedHands(
        playerUuids[0],
        clubCode
      );
      expect(allSharedHands).toHaveLength(lastHand);

      const allSharedHands1 = await handutils.getsharedHand(
        playerUuids[0],
        clubCode,
        id
      );
      expect(allSharedHands1.id).toBe(id);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test.skip('Handtest: Bookmark hands', async () => {
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
    //const rewardId = await createReward(owner, clubCode);
    const [gameCode, gameId] = await setupGameEnvironment(
      SERVER_API,
      owner,
      clubCode,
      playerUuids,
      holdemGameInput,
    );
    // const rewardTrackId = await rewardutils.getRewardtrack(
    //   playerUuids[0],
    //   gameCode,
    //   rewardId.toString()
    // );

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
        //rewardTrackId,
        playerIds
      );
      const resp = await axios.post(
        `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${data.handNum}`,
        data
      );
      expect(resp.status).toBe(200);
      const test = await handutils.saveBookmarkHand(gameCode, playerUuids[0], data.handNum);
      console.log(test)
      lastHand += 1;
    }
    const bookmarkedHand = await handutils.getBookmarkedHands(playerUuids[0]);
    expect(bookmarkedHand).toHaveLength(lastHand);

    const bookmarkedHand1 = await handutils.getBookmarkedHands(playerUuids[1]);
    expect(bookmarkedHand1).toHaveLength(0);
  });
});
