import {PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase, getClient} from './utils/utils';
import * as handutils from './utils/hand.testutils';
import * as clubutils from './utils/club.testutils';
import * as gameutils from './utils/game.testutils';
import * as rewardutils from './utils/reward.testutils';

const allInHand = {
  clubId: 1,
  gameId: 1,
  handNum: 1,
  messageType: 'RESULT',
  handStatus: 'RESULT',
  handResult: {
    preflopActions: {
      pot: 3,
      actions: [
        {
          seatNo: 5,
          amount: 1,
        },
        {
          seatNo: 8,
          action: 'BB',
          amount: 2,
        },
        {
          seatNo: 1,
          action: 'ALLIN',
        },
        {
          seatNo: 5,
          action: 'ALLIN',
        },
        {
          seatNo: 8,
          action: 'ALLIN',
        },
      ],
    },
    flopActions: {},
    turnActions: {},
    riverActions: {},
    potWinners: {
      '0': {
        hiWinners: [
          {
            seatNo: 1,
            amount: 150,
            winningCards: [200, 196, 8, 132, 1],
            winningCardsStr: '[ A♣  A♦  2♣  T♦  2♠ ]',
            rankStr: 'Two Pair',
            rank: 1000,
          },
        ],
        loWinners: [
          {
            seatNo: 1,
            amount: 150,
            winningCards: [200, 196, 8, 132, 1],
            winningCardsStr: '[ A♣  A♦  2♣  T♦  2♠ ]',
            rankStr: 'Two Pair',
            rank: 1000,
          },
        ],
      },
    },
    wonAt: 'SHOW_DOWN',
    rank: 1000,
    tips: 2.0,
    totalPot: 150,
    balanceAfterHand: [
      {
        seatNo: 1,
        playerId: 1,
        balance: 150,
      },
    ],
    handStartedAt: '1595385733',
    balanceBeforeHand: [
      {
        seatNo: 1,
        playerId: 1,
        balance: 50,
      },
    ],
    handEndedAt: '1595385735',
    playersInSeats: [1, 0, 0, 0, 2, 0, 0, 3, 0],
  },
};

const rewardHandData = {
  gameId: '1',
  handNum: 1,
  gameType: 'HOLDEM',
  handLog: {
    preflopActions: {
      pot: 3,
      actions: [
        {
          seatNo: 5,
          action: 'SB',
          amount: 1,
          timedOut: false,
        },
        {
          seatNo: 8,
          action: 'BB',
          amount: 2,
          timedOut: false,
        },
        {
          seatNo: 1,
          action: 'ALLIN',
          amount: 0,
          timedOut: false,
        },
        {
          seatNo: 5,
          action: 'ALLIN',
          amount: 0,
          timedOut: false,
        },
        {
          seatNo: 8,
          action: 'ALLIN',
          amount: 0,
          timedOut: false,
        },
      ],
    },
    flopActions: {
      pot: 0,
      actions: [],
    },
    turnActions: {
      pot: 0,
      actions: [],
    },
    riverActions: {
      pot: 0,
      actions: [],
    },
    potWinners: {
      0: {
        hiWinners: [
          {
            seatNo: 1,
            loCard: false,
            amount: 150,
            winningCards: [24, 8, 56, 200, 40],
            winningCardsStr: '[ 3♣  2♣  5♣  A♣  4♣ ]',
            rankStr: 'Straight Flush',
          },
        ],
        lowWinners: [],
      },
    },
    wonAt: 'SHOW_DOWN',
    showDown: null,
    handStartedAt: '1607771393',
    handEndedAt: '1607771395',
  },
  rewardTrackingIds: ['10', '20'],
  boardCards: [4],
  boardCards2: [],
  flop: [24, 20, 8],
  turn: 56,
  river: 178,
  players: {
    1: {
      id: '1',
      cards: [200, 40],
      bestCards: [24, 8, 56, 200, 40],
      rank: 10,
      playedUntil: 'RIVER',
      balance: {
        before: 50,
        after: 150,
      },
    },
    5: {
      id: '2',
      cards: [18, 17],
      bestCards: [24, 20, 178, 18, 17],
      rank: 144,
      playedUntil: 'RIVER',
      balance: {
        before: 50,
        after: 0,
      },
    },
    8: {
      id: '3',
      cards: [4, 1],
      bestCards: [24, 20, 8, 4, 1],
      rank: 322,
      playedUntil: 'RIVER',
      balance: {
        before: 50,
        after: 0,
      },
    },
  },
};

const flopHand = {
  clubId: 1,
  gameId: 2,
  handNum: 1,
  messageType: 'RESULT',
  handStatus: 'RESULT',
  handResult: {
    preflopActions: {
      pot: 7,
      actions: [
        {
          seatNo: 5,
          amount: 1,
        },
        {
          seatNo: 8,
          action: 'BB',
          amount: 2,
        },
        {
          seatNo: 1,
          action: 'CALL',
          amount: 2,
        },
        {
          seatNo: 5,
          action: 'CALL',
          amount: 2,
        },
        {
          seatNo: 8,
          action: 'CHECK',
        },
      ],
    },
    flopActions: {
      pot: 8,
      actions: [
        {
          seatNo: 5,
          action: 'CHECK',
        },
        {
          seatNo: 8,
          action: 'BET',
          amount: 2,
        },
        {
          seatNo: 1,
          action: 'CALL',
          amount: 2,
        },
        {
          seatNo: 5,
          action: 'RAISE',
          amount: 4,
        },
        {
          seatNo: 8,
          action: 'FOLD',
        },
        {
          seatNo: 1,
          action: 'FOLD',
        },
      ],
    },
    turnActions: {},
    riverActions: {},
    potWinners: {
      '0': {
        hiWinners: [
          {
            seatNo: 5,
            amount: 14,
          },
        ],
      },
    },
    wonAt: 'FLOP',
    tips: 2.0,
    balanceAfterHand: [
      {
        seatNo: 1,
        playerId: 1,
        balance: 96,
      },
    ],
    handStartedAt: '1595385736',
    balanceBeforeHand: [
      {
        seatNo: 1,
        playerId: 1,
        balance: 100,
      },
    ],
    handEndedAt: '1595385739',
    playersInSeats: [1, 0, 0, 0, 2, 0, 0, 3, 0],
  },
};

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
  const rewardId = await getClient(playerId).mutate({
    variables: {
      clubCode: clubCode,
      input: rewardInput,
    },
    mutation: rewardutils.createReward,
  });
  holdemGameInput.rewardIds.splice(0);
  holdemGameInput.rewardIds.push(rewardId.data.rewardId);
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
  [number, number, number, string, string, string]
> {
  const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
  const player = await handutils.getPlayerById(playerId);
  await createGameServer('1.2.0.1');

  await saveReward(playerId, clubCode);

  const game1 = await gameutils.configureGame(
    playerId,
    clubCode,
    holdemGameInput
  );
  const clubID = await clubutils.getClubById(clubCode);
  const gameID = await gameutils.getGameById(game1.gameCode);
  const messageInput = {
    clubId: clubID,
    playerId: player,
    gameId: gameID,
    buyIn: 100.0,
    status: 'PLAYING',
    seatNo: 1,
  };

  await axios.post(`${SERVER_API}/player-sit-in`, messageInput);
  return [clubID, player, gameID, playerId, clubCode, game1.gameCode];
}

describe('Hand Server', () => {
  beforeEach(async done => {
    await resetDatabase();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('Save Post hand data', async () => {
    await createClubAndStartGame();
    const resp = await axios.post(
      `${SERVER_API}/post-save-hand`,
      rewardHandData
    );
    expect(resp.status).toBe(200);
    expect(resp.data.status).toBe('OK');
  });

  test('Save hand data', async () => {
    const [clubId, playerId, gameId] = await createClubAndStartGame();
    allInHand.handNum = 1;
    allInHand.gameId = gameId;
    allInHand.clubId = clubId;
    allInHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
    allInHand.handResult.potWinners[0].loWinners[0].seatNo = 1;
    allInHand.handResult.balanceAfterHand[0].playerId = playerId;
    allInHand.handResult.playersInSeats = [playerId];
    const resp = await axios.post(`${SERVER_API}/save-hand`, allInHand);
    expect(resp.status).toBe(200);
    expect(resp.data.status).toBe('OK');

    flopHand.handNum = 2;
    flopHand.gameId = gameId;
    flopHand.clubId = clubId;
    flopHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
    flopHand.handResult.balanceAfterHand[0].playerId = playerId;
    flopHand.handResult.playersInSeats = [playerId];
    const resp1 = await axios.post(`${SERVER_API}/save-hand`, flopHand);
    expect(resp1.status).toBe(200);
    expect(resp1.data.status).toBe('OK');
  });

  test('Get specific hand history', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createClubAndStartGame();
    allInHand.handNum = 1;
    allInHand.gameId = gameId;
    allInHand.clubId = clubId;
    allInHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
    allInHand.handResult.potWinners[0].loWinners[0].seatNo = 1;
    allInHand.handResult.balanceAfterHand[0].playerId = playerId;
    allInHand.handResult.playersInSeats = [playerId];
    await axios.post(`${SERVER_API}/save-hand`, allInHand);

    const resp = await handutils.getSpecificHandHistory(
      playerUuid,
      clubCode,
      gameCode,
      '1'
    );
    expect(resp.gameType).toBe('HOLDEM');
    expect(resp.wonAt).toBe('SHOW_DOWN');
  });

  test('Get latest hand history', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createClubAndStartGame();

    allInHand.gameId = gameId;
    allInHand.clubId = clubId;
    allInHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
    allInHand.handResult.potWinners[0].loWinners[0].seatNo = 1;
    allInHand.handResult.balanceAfterHand[0].playerId = playerId;
    allInHand.handResult.playersInSeats = [playerId];

    for (let i = 1; i < 5; i++) {
      allInHand.handNum = i;
      await axios.post(`${SERVER_API}/save-hand`, allInHand);
    }
    const resp1 = await handutils.getLastHandHistory(
      playerUuid,
      clubCode,
      gameCode
    );
    expect(resp1.gameType).toBe('HOLDEM');
    expect(resp1.wonAt).toBe('SHOW_DOWN');
    expect(resp1.handNum).toBe(4);
  });

  test('Get all hand history', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createClubAndStartGame();

    allInHand.gameId = gameId;
    allInHand.clubId = clubId;
    allInHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
    allInHand.handResult.potWinners[0].loWinners[0].seatNo = 1;
    allInHand.handResult.balanceAfterHand[0].playerId = playerId;
    allInHand.handResult.playersInSeats = [playerId];
    for (let i = 1; i < 5; i++) {
      allInHand.handNum = i;
      await axios.post(`${SERVER_API}/save-hand`, allInHand);
    }
    const resp1 = await handutils.getAllHandHistory(
      playerUuid,
      clubCode,
      gameCode
    );
    expect(resp1).toHaveLength(4);
  });

  test('Get all hand history pagination', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createClubAndStartGame();

    allInHand.gameId = gameId;
    allInHand.clubId = clubId;
    allInHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
    allInHand.handResult.potWinners[0].loWinners[0].seatNo = 1;
    allInHand.handResult.balanceAfterHand[0].playerId = playerId;
    allInHand.handResult.playersInSeats = [playerId];
    for (let i = 1; i < 17; i++) {
      allInHand.handNum = i;
      await axios.post(`${SERVER_API}/save-hand`, allInHand);
    }
    const resp1 = await handutils.getAllHandHistory(
      playerUuid,
      clubCode,
      gameCode
    );
    expect(resp1).toHaveLength(10);

    const lastHand = resp1[9];
    const resp2 = await handutils.getAllHandHistory(
      playerUuid,
      clubCode,
      gameCode,
      {
        prev: lastHand.pageId,
        count: 5,
      }
    );
    expect(resp2).toHaveLength(5);
  });

  test('Get my winning hands', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createClubAndStartGame();

    allInHand.gameId = gameId;
    allInHand.clubId = clubId;
    allInHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
    allInHand.handResult.potWinners[0].loWinners[0].seatNo = 1;
    allInHand.handResult.balanceAfterHand[0].playerId = playerId;
    allInHand.handResult.playersInSeats = [playerId];
    for (let i = 1; i < 5; i++) {
      allInHand.handNum = i;
      await axios.post(`${SERVER_API}/save-hand`, allInHand);
    }
    const resp1 = await handutils.getMyWinningHands(
      playerUuid,
      clubCode,
      gameCode
    );
    expect(resp1).toHaveLength(8);
    resp1.forEach(element => {
      expect(element.playerId).toBe(playerId);
    });
  });

  test('Get my winning hands pagination', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createClubAndStartGame();

    allInHand.gameId = gameId;
    allInHand.clubId = clubId;
    allInHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
    allInHand.handResult.potWinners[0].loWinners[0].seatNo = 1;
    allInHand.handResult.balanceAfterHand[0].playerId = playerId;
    allInHand.handResult.playersInSeats = [playerId];
    for (let i = 1; i < 17; i++) {
      allInHand.handNum = i;
      await axios.post(`${SERVER_API}/save-hand`, allInHand);
    }
    const resp1 = await handutils.getMyWinningHands(
      playerUuid,
      clubCode,
      gameCode
    );
    expect(resp1).toHaveLength(10);

    const lastHand = resp1[9];
    const resp2 = await handutils.getMyWinningHands(
      playerUuid,
      clubCode,
      gameCode,
      {
        prev: lastHand.pageId,
        count: 5,
      }
    );
    expect(resp2).toHaveLength(5);
  });

  test('Save starred hand', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createClubAndStartGame();

    allInHand.gameId = gameId;
    allInHand.clubId = clubId;
    allInHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
    allInHand.handResult.potWinners[0].loWinners[0].seatNo = 1;
    allInHand.handResult.balanceAfterHand[0].playerId = playerId;
    allInHand.handResult.playersInSeats = [playerId];
    allInHand.handNum = 1;
    await axios.post(`${SERVER_API}/save-hand`, allInHand);

    const resp = await handutils.saveStarredHand(
      clubCode,
      gameCode,
      playerUuid,
      '1'
    );
    expect(resp).toBe('true');
  });

  test('Get starred hand', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createClubAndStartGame();

    allInHand.gameId = gameId;
    allInHand.clubId = clubId;
    allInHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
    allInHand.handResult.potWinners[0].loWinners[0].seatNo = 1;
    allInHand.handResult.balanceAfterHand[0].playerId = playerId;
    allInHand.handResult.playersInSeats = [playerId];
    for (let i = 1; i < 30; i++) {
      allInHand.handNum = i;
      await axios.post(`${SERVER_API}/save-hand`, allInHand);
      await handutils.saveStarredHand(
        clubCode,
        gameCode,
        playerUuid,
        i.toString()
      );
    }

    const resp = await handutils.getStarredHands(playerUuid);
    expect(resp.length).toBe(25);
  });
});