import {initializeSqlLite} from './utils';
import {getLogger} from '../src/utils/log';
import {resetDB} from '../src/resolvers/reset';
import {createPlayer, getPlayerById} from '../src/resolvers/player';
import {
  approveMember,
  createClub,
  getClubById,
  joinClub,
} from '../src/resolvers/club';
import {createGameServer} from '../src/internal/gameserver';
import {buyIn, configureGame, joinGame, startGame} from '../src/resolvers/game';
import {saveReward} from '../src/resolvers/reward';
import {postHand} from '../src/internal/hand';
import * as fs from 'fs';
import * as glob from 'glob';
import _ from 'lodash';
import {
  getLastHandHistory,
  getSpecificHandHistory,
  getAllHandHistory,
  getMyWinningHands,
  shareHand,
  sharedHand,
  sharedHands,
  bookmarkHand,
  bookmarkedHands,
} from '../src/resolvers/hand';
import {getRewardTrack} from '../src/resolvers/reward';
const logger = getLogger('Hand server unit-test');

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

async function createReward1(playerId, clubCode) {
  const rewardInput = {
    amount: 100.4,
    endHour: 4,
    minRank: 1,
    name: 'brady',
    startHour: 4,
    type: 'HIGH_HAND',
    schedule: 'HOURLY',
  };
  const resp = await saveReward(playerId, clubCode, rewardInput);
  holdemGameInput.rewardIds.splice(0);
  holdemGameInput.rewardIds.push(resp);
  return resp;
}

async function createClubWithMembers(
  ownerInput: any,
  clubInput: any,
  players: Array<any>
): Promise<[string, string, number, Array<string>, Array<number>]> {
  const ownerUuid = await createPlayer({player: ownerInput});
  clubInput.ownerUuid = ownerUuid;
  const clubCode = await createClub(ownerUuid, clubInput);
  const clubId = await getClubById(ownerUuid, clubCode);
  const playerUuids = new Array<string>();
  const playerIds = new Array<number>();
  for (const playerInput of players) {
    const playerUuid = await createPlayer({player: playerInput});
    const playerId = (await getPlayerById(playerUuid)).id;
    await joinClub(playerUuid, clubCode);
    await approveMember(ownerUuid, clubCode, playerUuid);
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
  await createGameServer(gameServer);
  const game = await configureGame(owner, club, holdemGameInput);
  let i = 1;
  for await (const player of players) {
    await joinGame(player, game.gameCode, i);
    await buyIn(player, game.gameCode, buyin);
    i++;
  }
  await startGame(owner, game.gameCode);
  return [game.gameCode, game.id];
}

async function defaultHandData(
  file: string,
  gameId: number,
  //rewardId: any,
  playerIds: Array<number>
) {
  const obj = await fs.readFileSync(`highhand-results/${file}`, 'utf8');
  const data = JSON.parse(obj);
  data.gameId = gameId.toString();
  //data.rewardTrackingIds.splice(0);
  //data.rewardTrackingIds.push(rewardId);
  data.players['1'].id = playerIds[0].toString();

  data.gameId = gameId.toString();
  data.players['2'].id = playerIds[1].toString();

  data.gameId = gameId.toString();
  data.players['3'].id = playerIds[2].toString();
  return data;
}

describe('Hand server APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('Handtest: Save hand data', async () => {
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
        owner,
        clubCode,
        playerUuids,
        100
      );
      // const rewardTrackId = await getRewardTrack(
      //   playerUuids[0],
      //   gameCode,
      //   rewardId.toString()
      // );
      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'highhand-results',
        deep: 5,
      });

      for await (const file of files) {
        const data = await defaultHandData(
          file,
          gameId,
          //rewardTrackId,
          playerIds
        );
        const resp = await postHand(gameId, data.handNum, data);
        expect(resp).not.toBe(null);
      }
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Handtest: Get specific hand history', async () => {
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
        owner,
        clubCode,
        playerUuids,
        100
      );
      // const rewardTrackId = await getRewardTrack(
      //   playerUuids[0],
      //   gameCode,
      //   rewardId.toString()
      // );

      const files = await glob.sync('**/*.json', {
        onlyFiles: false,
        cwd: 'highhand-results',
        deep: 5,
      });

      for await (const file of files) {
        const data = await defaultHandData(
          file,
          gameId,
          //rewardTrackId,
          playerIds
        );
        const resp = await postHand(gameId, data.handNum, data);
        expect(resp).not.toBe(null);
      }
      const handHistory = await getSpecificHandHistory(playerUuids[0], {
        clubCode: clubCode,
        gameCode: gameCode,
        handNum: 1,
      });
      expect(handHistory.gameType).toBe('HOLDEM');
      expect(handHistory.gameId).toBe(gameId);
      expect(handHistory.handNum).toBe(1);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test.skip('Handtest: Get latest hand history', async () => {
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
        owner,
        clubCode,
        playerUuids,
        100
      );
      // const rewardTrackId = await getRewardTrack(
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
        const resp = await postHand(gameId, data.handNum, data);
        expect(resp).not.toBe(null);
        lastHand += 1;
      }
      const handHistory = await getLastHandHistory(playerUuids[0], {
        clubCode: clubCode,
        gameCode: gameCode,
      });
      expect(handHistory.gameType).toBe('HOLDEM');
      expect(handHistory.gameId).toBe(gameId);
      expect(handHistory.handNum).toBe(lastHand);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Handtest: Get all hand history', async () => {
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
    //const rewardId = await createReward(owner, clubCode);
    const [gameCode, gameId] = await setupGameEnvironment(
      owner,
      clubCode,
      playerUuids,
      100
    );
    // const rewardTrackId = await getRewardTrack(
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
      const resp = await postHand(gameId, data.handNum, data);
      expect(resp).not.toBe(null);
      lastHand += 1;
    }
    const handHistory = await getAllHandHistory(playerUuids[0], {
      clubCode: clubCode,
      gameCode: gameCode,
    });
    expect(handHistory).toHaveLength(lastHand);
  });

  test('Handtest: Get all hand history pagination', async () => {
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
    //const rewardId = await createReward(owner, clubCode);
    const [gameCode, gameId] = await setupGameEnvironment(
      owner,
      clubCode,
      playerUuids,
      100
    );
    // const rewardTrackId = await getRewardTrack(
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
      const resp = await postHand(gameId, data.handNum, data);
      expect(resp).not.toBe(null);
      lastHand += 1;
    }

    /*
    const handHistory = await getAllHandHistory(playerUuids[0], {
      clubCode: clubCode,
      gameCode: gameCode,
      page: {
        count: lastHand - 2,
      },
    });
    expect(handHistory).toHaveLength(lastHand - 2);
    const handHistory1 = await getAllHandHistory(playerUuids[0], {
      clubCode: clubCode,
      gameCode: gameCode,
      page: {
        prev: handHistory[lastHand - 3].pageId,
        count: 2,
      },
    });
    expect(handHistory1).toHaveLength(2);
    */
  });

  // TODO:
  // 1. what is the winning rank in the json
  // 2. Not stored the hand winners
  test.skip('Handtest: Get my winning hands', async () => {
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
        owner,
        clubCode,
        playerUuids,
        100
      );
      // const rewardTrackId = await getRewardTrack(
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
        const resp = await postHand(gameId, data.handNum, data);
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
      const winningHands = await getMyWinningHands(playerUuids[1], {
        clubCode: clubCode,
        gameCode: gameCode,
      });
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

  test.skip('Handtest: Get my winning hands pagination', async () => {
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
        owner,
        clubCode,
        playerUuids,
        100
      );
      // const rewardTrackId = await getRewardTrack(
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
        const resp = await postHand(gameId, data.handNum, data);
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
      const winningHands = await getMyWinningHands(playerUuids[1], {
        clubCode: clubCode,
        gameCode: gameCode,
        page: {
          count: noOfWinningPlayer2 - 1,
        },
      });
      const winningHands1 = await getMyWinningHands(playerUuids[1], {
        clubCode: clubCode,
        gameCode: gameCode,
        page: {
          prev: winningHands[noOfWinningPlayer2 - 2].pageId,
          count: 3,
        },
      });
      console.log(winningHands, winningHands1);
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
      owner,
      clubCode,
      playerUuids,
      100
    );
    // const rewardTrackId = await getRewardTrack(
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
      const resp = await postHand(gameId, data.handNum, data);
      expect(resp).not.toBe(null);
      await bookmarkHand(playerUuids[0], {
        gameCode: gameCode,
        handNum: data.handNum,
      });
      lastHand += 1;
    }

    const bookmarkedHand = await bookmarkedHands(playerUuids[0], {});
    expect(bookmarkedHand).toHaveLength(lastHand);
  });

  test('Handtest: Share hands', async () => {
    //try {
    const [
      owner,
      clubCode,
      clubId,
      playerUuids,
      playerIds,
    ] = await createClubWithMembers(ownerInput, clubInput, playersInput);
    //const rewardId = await createReward(owner, clubCode);
    const [gameCode, gameId] = await setupGameEnvironment(
      owner,
      clubCode,
      playerUuids,
      100
    );
    // const rewardTrackId = await getRewardTrack(
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
    let id = 0;
    for await (const file of files) {
      const data = await defaultHandData(
        file,
        gameId,
        //rewardTrackId,
        playerIds
      );
      const resp = await postHand(gameId, data.handNum, data);
      expect(resp).not.toBe(null);
      id = await shareHand(playerUuids[0], {
        clubCode: clubCode,
        gameCode: gameCode,
        handNum: data.handNum,
      });
      lastHand += 1;
    }

    const allSharedHands = await sharedHands(playerUuids[0], {
      clubCode: clubCode,
    });
    expect(allSharedHands).toHaveLength(lastHand);

    const allSharedHands1 = await sharedHand(playerUuids[0], {
      id: id,
      clubCode: clubCode,
    });
    expect(allSharedHands1.id).toBe(id);
    expect(allSharedHands1.sharedTo.name).toBe(clubInput.name);
    // } catch (err) {
    //   logger.error(JSON.stringify(err));
    //   expect(true).toBeFalsy();
    // }
  });
});
