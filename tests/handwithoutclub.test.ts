import {PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase} from './utils/utils';
import * as handutils from './utils/hand.testutils';
import * as clubutils from './utils/club.testutils';
import * as gameutils from './utils/game.testutils';

const allInHand = {
  clubId: 1,
  gameNum: 1,
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

const flopHand = {
  clubId: 1,
  gameNum: 2,
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
};

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

async function createPlayerStartFriendsGame(): Promise<
  [number, number, number, string, string, string]
> {
  await createGameServer('1.2.0.1');
  const playerUuid = await clubutils.createPlayer('player1', 'abc123');
  const game = await gameutils.configureFriendsGame(
    playerUuid,
    holdemGameInput
  );
  const playerID = await handutils.getPlayerById(playerUuid);
  const gameID = await gameutils.getGameById(game.gameCode);
  const messageInput = {
    clubId: 0,
    playerId: playerID,
    gameId: gameID,
    buyIn: 100.0,
    status: 'PLAYING',
    seatNo: 5,
  };
  await axios.post(`${SERVER_API}/player-sit-in`, messageInput);
  return [0, playerID, gameID, playerUuid, '000000', game.gameCode];
}

describe('Hand Server without club', () => {
  beforeEach(async done => {
    await resetDatabase();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('Save hand data without club', async () => {
    const [
      clubId,
      playerID,
      gameID,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createPlayerStartFriendsGame();

    allInHand.handNum = 1;
    allInHand.gameNum = gameID;
    allInHand.clubId = 0;
    allInHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
    allInHand.handResult.potWinners[0].loWinners[0].seatNo = 1;
    allInHand.handResult.balanceAfterHand[0].playerId = playerID;
    allInHand.handResult.playersInSeats = [playerID];
    const resp = await axios.post(`${SERVER_API}/save-hand`, allInHand);
    expect(resp.status).toBe(200);
    expect(resp.data.status).toBe('OK');

    flopHand.handNum = 2;
    flopHand.gameNum = gameID;
    flopHand.clubId = 0;
    flopHand.handResult.potWinners[0].hiWinners[0].seatNo = 1;
    flopHand.handResult.balanceAfterHand[0].playerId = playerID;
    flopHand.handResult.playersInSeats = [playerID];
    const resp1 = await axios.post(`${SERVER_API}/save-hand`, flopHand);
    expect(resp1.status).toBe(200);
    expect(resp1.data.status).toBe('OK');
  });

  test('Get specific hand history without club', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createPlayerStartFriendsGame();

    allInHand.handNum = 1;
    allInHand.gameNum = gameId;
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

  test('Get latest hand history without club', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createPlayerStartFriendsGame();

    allInHand.gameNum = gameId;
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

  test('Get all hand history without club', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createPlayerStartFriendsGame();

    allInHand.gameNum = gameId;
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

  test('Get all hand history pagination without club', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createPlayerStartFriendsGame();

    allInHand.gameNum = gameId;
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

  test('Get my winning hands without club', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createPlayerStartFriendsGame();

    allInHand.gameNum = gameId;
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

  test('Get my winning hands pagination without club', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createPlayerStartFriendsGame();

    allInHand.gameNum = gameId;
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

  test('Save starred hand without club', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createPlayerStartFriendsGame();

    allInHand.gameNum = gameId;
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

  test('Get starred hand without club', async () => {
    const [
      clubId,
      playerId,
      gameId,
      playerUuid,
      clubCode,
      gameCode,
    ] = await createPlayerStartFriendsGame();
    allInHand.gameNum = gameId;
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
