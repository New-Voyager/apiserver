import {PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase, getClient} from './utils/utils';
import * as handutils from './utils/hand.testutils';
import * as clubutils from './utils/club.testutils';
import * as gameutils from './utils/game.testutils';
import * as rewardutils from './utils/reward.testutils';

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

const hand1 = {
  gameId: '2',
  handNum: 1,
  gameType: 'HOLDEM',
  handLog: {
    preflopActions: {
      pot: 7,
      actions: [
        {
          seatNo: 2,
          action: 'SB',
          amount: 1,
          timedOut: false,
        },
        {
          seatNo: 3,
          action: 'BB',
          amount: 2,
          timedOut: false,
        },
        {
          seatNo: 1,
          action: 'CALL',
          amount: 2,
          timedOut: false,
        },
        {
          seatNo: 2,
          action: 'CALL',
          amount: 2,
          timedOut: false,
        },
        {
          seatNo: 3,
          action: 'CHECK',
          amount: 0,
          timedOut: false,
        },
      ],
    },
    flopActions: {
      pot: 12,
      actions: [
        {
          seatNo: 2,
          action: 'CHECK',
          amount: 0,
          timedOut: false,
        },
        {
          seatNo: 3,
          action: 'BET',
          amount: 2,
          timedOut: false,
        },
        {
          seatNo: 1,
          action: 'CALL',
          amount: 2,
          timedOut: false,
        },
        {
          seatNo: 2,
          action: 'RAISE',
          amount: 4,
          timedOut: false,
        },
        {
          seatNo: 3,
          action: 'FOLD',
          amount: 0,
          timedOut: false,
        },
        {
          seatNo: 1,
          action: 'CALL',
          amount: 4,
          timedOut: false,
        },
      ],
    },
    turnActions: {
      pot: 20,
      actions: [
        {
          seatNo: 2,
          action: 'CHECK',
          amount: 0,
          timedOut: false,
        },
        {
          seatNo: 1,
          action: 'BET',
          amount: 10,
          timedOut: false,
        },
        {
          seatNo: 2,
          action: 'CALL',
          amount: 10,
          timedOut: false,
        },
      ],
    },
    riverActions: {
      pot: 20,
      actions: [
        {
          seatNo: 2,
          action: 'BET',
          amount: 10,
          timedOut: false,
        },
        {
          seatNo: 1,
          action: 'CALL',
          amount: 10,
          timedOut: false,
        },
      ],
    },
    potWinners: {
      '0': {
        hiWinners: [
          {
            seatNo: 2,
            loCard: false,
            amount: 56,
            winningCards: [8, 40, 24, 56, 72],
            winningCardsStr: '[ 2♣  4♣  3♣  5♣  6♣ ]',
            rankStr: 'Straight Flush',
          },
        ],
        lowWinners: [],
      },
    },
    wonAt: 'SHOW_DOWN',
    showDown: null,
    handStartedAt: '1607817819',
    handEndedAt: '1607817829',
  },
  rewardTrackingIds: [2],
  boardCards: [200, 196, 8, 40, 24],
  boardCards2: [],
  flop: [200, 196, 8],
  turn: 40,
  river: 24,
  players: {
    '1': {
      id: '1',
      cards: [4, 1],
      bestCards: [200, 196, 8, 4, 1],
      rank: 311,
      playedUntil: 'RIVER',
      balance: {
        before: 100,
        after: 74,
      },
    },
    '2': {
      id: '2',
      cards: [56, 72],
      bestCards: [8, 40, 24, 56, 72],
      rank: 9,
      playedUntil: 'RIVER',
      balance: {
        before: 100,
        after: 130,
      },
    },
    '3': {
      id: '3',
      cards: [193, 194],
      bestCards: [],
      rank: 4294967295,
      playedUntil: 'RIVER',
      balance: {
        before: 100,
        after: 96,
      },
    },
  },
};

const hand2 = {
  gameId: '2',
  handNum: 2,
  gameType: 'HOLDEM',
  handLog: {
    preflopActions: {
      pot: 7,
      actions: [
        {
          seatNo: 2,
          action: 'SB',
          amount: 1,
          timedOut: false,
        },
        {
          seatNo: 3,
          action: 'BB',
          amount: 2,
          timedOut: false,
        },
        {
          seatNo: 1,
          action: 'CALL',
          amount: 2,
          timedOut: false,
        },
        {
          seatNo: 2,
          action: 'CALL',
          amount: 2,
          timedOut: false,
        },
        {
          seatNo: 3,
          action: 'CHECK',
          amount: 0,
          timedOut: false,
        },
      ],
    },
    flopActions: {
      pot: 12,
      actions: [
        {
          seatNo: 2,
          action: 'CHECK',
          amount: 0,
          timedOut: false,
        },
        {
          seatNo: 3,
          action: 'BET',
          amount: 2,
          timedOut: false,
        },
        {
          seatNo: 1,
          action: 'CALL',
          amount: 2,
          timedOut: false,
        },
        {
          seatNo: 2,
          action: 'RAISE',
          amount: 4,
          timedOut: false,
        },
        {
          seatNo: 3,
          action: 'FOLD',
          amount: 0,
          timedOut: false,
        },
        {
          seatNo: 1,
          action: 'CALL',
          amount: 4,
          timedOut: false,
        },
      ],
    },
    turnActions: {
      pot: 20,
      actions: [
        {
          seatNo: 2,
          action: 'CHECK',
          amount: 0,
          timedOut: false,
        },
        {
          seatNo: 1,
          action: 'BET',
          amount: 10,
          timedOut: false,
        },
        {
          seatNo: 2,
          action: 'CALL',
          amount: 10,
          timedOut: false,
        },
      ],
    },
    riverActions: {
      pot: 20,
      actions: [
        {
          seatNo: 2,
          action: 'BET',
          amount: 10,
          timedOut: false,
        },
        {
          seatNo: 1,
          action: 'CALL',
          amount: 10,
          timedOut: false,
        },
      ],
    },
    potWinners: {
      '0': {
        hiWinners: [
          {
            seatNo: 2,
            loCard: false,
            amount: 56,
            winningCards: [200, 184, 168, 136, 152],
            winningCardsStr: '[ A♣  K♣  Q♣  T♣  J♣ ]',
            rankStr: 'Straight Flush',
          },
        ],
        lowWinners: [],
      },
    },
    wonAt: 'SHOW_DOWN',
    showDown: null,
    handStartedAt: '1607817832',
    handEndedAt: '1607817842',
  },
  rewardTrackingIds: [2],
  boardCards: [200, 196, 184, 168, 17],
  boardCards2: [],
  flop: [200, 196, 184],
  turn: 168,
  river: 17,
  players: {
    '1': {
      id: '1',
      cards: [180, 177],
      bestCards: [200, 196, 184, 180, 177],
      rank: 179,
      playedUntil: 'RIVER',
      balance: {
        before: 100,
        after: 74,
      },
    },
    '2': {
      id: '2',
      cards: [136, 152],
      bestCards: [200, 184, 168, 136, 152],
      rank: 1,
      playedUntil: 'RIVER',
      balance: {
        before: 100,
        after: 130,
      },
    },
    '3': {
      id: '3',
      cards: [193, 194],
      bestCards: [],
      rank: 4294967295,
      playedUntil: 'RIVER',
      balance: {
        before: 100,
        after: 96,
      },
    },
  },
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
  hand1.rewardTrackingIds.splice(0);
  hand1.rewardTrackingIds.push(rewardId.data.rewardId);
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
  // const messageInput = {
  //   clubId: clubID,
  //   playerId: player,
  //   gameId: gameID,
  //   buyIn: 100.0,
  //   status: 'PLAYING',
  //   seatNo: 1,
  // };

  // await axios.post(`${SERVER_API}/player-sit-in`, messageInput);
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

  test('Get logged data by game', async () => {
    const [
      clubId,
      playerId,
      gameId,
      player,
      clubCode,
      gameCode,
    ] = await createClubAndStartGame();
    hand1.handNum = 1;
    hand1.gameId = gameId.toString();
    hand1.players['2'].id = playerId.toString();

    const playerId2 = await clubutils.createPlayer('adam', 'test1');

    hand2.gameId = gameId.toString();
    hand2.players['2'].id = playerId2.toString();

    const resp = await axios.post(
      `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${hand1.handNum}`,
      hand1
    );
    const response = await axios.post(
      `${SERVER_API}/save-hand/gameId/${gameId}/handNum/${hand2.handNum}`,
      hand1
    );
    expect(resp.data.status).toBe('OK');
    const resp1 = await rewardutils.getlogDatabyGame(
      playerId.toString(),
      gameCode.toString()
    );
    expect(resp1).not.toBeNull();
    const resp2 = await rewardutils.getlogDatabyReward(
      playerId.toString(),
      gameCode.toString(),
      rewardId.toString()
    );
  });
});
