import {PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase} from './utils/utils';
import * as handutils from './utils/hand.testutils';
import * as clubutils from './utils/club.testutils';
import * as gameutils from './utils/game.testutils';
import {Player} from '../src/entity/player';

const handData = {
  ClubId: '',
  GameNum: '',
  HandNum: '1',
  Players: [1000, 1001, 20001, 30001, 40001],
  GameType: 'HOLDEM',
  StartedAt: '2020-06-30T00:02:10',
  EndedAt: '2020-06-30T00:04:00',
  PREFLOP: {
    actions: [
      {
        player: 1001,
        action: 'SB',
        amount: 1.0,
        balance: 97.0,
      },
      {
        player: 20001,
        action: 'BB',
        amount: 2.0,
        balance: 98.0,
      },
      {
        player: 30001,
        action: 'FOLD',
        balance: 132.0,
      },
      {
        player: 40001,
        action: 'RAISE',
        amount: 15.0,
        balance: 70.0,
      },
      {
        player: 1000,
        action: 'FOLD',
        balance: 85.0,
      },
      {
        player: 1001,
        action: 'CALL',
        amount: 15.0,
        balance: 83.0,
      },
      {
        player: 20001,
        action: 'RAISE',
        amount: 30.0,
        balance: 70.0,
      },
      {
        player: 40001,
        action: 'ALLIN',
        amount: 85.0,
        balance: 0.0,
      },
      {
        player: 1001,
        action: 'FOLD',
        balance: 83.0,
      },
      {
        player: 20001,
        action: 'CALL',
        amount: 85.0,
        balance: 0.0,
      },
    ],
    pots: [
      {
        no: 0,
        amount: 186.0,
        players: [40001, 20001],
      },
    ],
  },
  FLOP: {
    cards: ['Ac', '8d', '4s'],
    actions: [],
    pots: [
      {
        no: 0,
        amount: 186.0,
        players: [40001, 20001],
      },
    ],
  },
  TURN: {
    cards: ['Ac', '8d', '4s', 'Qh'],
    actions: [],
    pots: [
      {
        no: 0,
        amount: 186.0,
        players: [40001, 20001],
      },
    ],
  },
  RIVER: {
    cards: ['Ac', '8d', '4s', 'Qh', 'Ad'],
    actions: [],
    pots: [
      {
        no: 0,
        amount: 186.0,
        players: [40001, 20001],
      },
    ],
  },
  SHOWDOWN: {
    cards: ['Ac', '8d', '4s', 'Qh', 'Ad'],
    pots: [
      {
        no: 0,
        amount: 186.0,
        players: [40001, 20001],
      },
    ],
    player_cards: [
      {
        player: 40001,
        cards: ['Kh', 'Ks'],
      },
      {
        player: 20001,
        cards: ['Kd', 'Kc'],
      },
    ],
  },
  Result: {
    pot_winners: [
      {
        pot: 0,
        amount: 186.0,
        winners: [
          {
            player: 1,
            received: 93.0,
            rank: 'TWO PAIR',
            rank_num: 1203,
            winning_cards: ['Ah', 'As', 'Kh', 'Ks', 'Qh'],
          },
        ],
      },
    ],
    won_at: 'SHOWDOWN',
    showdown: true,
    winning_rank: 'TWO PAIR',
    rank_num: 1023,
    winning_cards: ['Ah', 'As', 'Kh', 'Kc', 'Qh'],
    total_pot: 186.0,
    summary: [
      {
        player: 1000,
        balance: 85.0,
        change: 0.0,
      },
      {
        player: 1001,
        balance: 83.0,
        change: -15.0,
      },
      {
        player: 20001,
        balance: 98.5,
        change: 0.5,
      },
      {
        player: 30001,
        balance: 132.0,
        change: 0.0,
      },
      {
        player: 40001,
        balance: 85.5,
        change: 0.5,
      },
    ],
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

const HANDSERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

async function createGameServer(ipAddress: string) {
  const gameServer1 = {
    ipAddress: ipAddress,
    currentMemory: 100,
    status: 'ACTIVE',
  };
  try {
    await axios.post(`${HANDSERVER_API}/register-game-server`, gameServer1);
  } catch (err) {
    expect(true).toBeFalsy();
  }
}

beforeAll(async done => {
  await resetDatabase();
  done();
});

afterAll(async done => {
  done();
});

describe('Hand Server', () => {
  test('Save hand data', async () => {
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    const player = await handutils.getPlayerById(playerId);
    await createGameServer('1.2.0.1');
    const game1 = await gameutils.startGame(playerId, clubId, holdemGameInput);
    handData.HandNum = '1';
    handData.GameNum = game1.gameId;
    handData.ClubId = clubId;
    handData.Result.pot_winners[0].winners[0].player = player;
    try {
      const resp = await axios.post(`${HANDSERVER_API}/save-hand`, handData);
      expect(resp.status).toBe(200);
      expect(resp.data.status).toBe('OK');
    } catch (err) {
      expect(true).toBeFalsy();
    }
  });

  test('Get specific hand history', async () => {
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.0.2');
    const player = await handutils.getPlayerById(playerId);
    const game1 = await gameutils.startGame(playerId, clubId, holdemGameInput);
    handData.HandNum = '1';
    handData.GameNum = game1.gameId;
    handData.ClubId = clubId;
    handData.Result.pot_winners[0].winners[0].player = player;
    await axios.post(`${HANDSERVER_API}/save-hand`, handData);
    const resp = await handutils.getSpecificHandHistory(
      playerId,
      clubId,
      game1.gameId,
      '1'
    );
    expect(resp.gameType).toBe('HOLDEM');
    expect(resp.wonAt).toBe('SHOWDOWN');
  });

  test('Get latest hand history', async () => {
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.0.3');
    const player = await handutils.getPlayerById(playerId);
    const game1 = await gameutils.startGame(playerId, clubId, holdemGameInput);
    handData.GameNum = game1.gameId;
    handData.ClubId = clubId;
    handData.Result.pot_winners[0].winners[0].player = player;
    for (let i = 1; i < 5; i++) {
      handData.HandNum = i.toString();
      await axios.post(`${HANDSERVER_API}/save-hand`, handData);
    }

    try {
      const resp1 = await handutils.getLastHandHistory(
        playerId,
        clubId,
        game1.gameId
      );
      expect(resp1.gameType).toBe('HOLDEM');
      expect(resp1.wonAt).toBe('SHOWDOWN');
      expect(resp1.handNum).toBe('4');
    } catch (err) {
      expect(true).toBeFalsy();
    }
  });

  test('Get all hand history', async () => {
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.0.4');
    const player = await handutils.getPlayerById(playerId);
    const game1 = await gameutils.startGame(playerId, clubId, holdemGameInput);
    handData.GameNum = game1.gameId;
    handData.ClubId = clubId;
    handData.Result.pot_winners[0].winners[0].player = player;
    for (let i = 1; i < 5; i++) {
      handData.HandNum = i.toString();
      await axios.post(`${HANDSERVER_API}/save-hand`, handData);
    }

    try {
      const resp1 = await handutils.getAllHandHistory(
        playerId,
        clubId,
        game1.gameId
      );
      expect(resp1).toHaveLength(4);
    } catch (err) {
      expect(true).toBeFalsy();
    }
  });

  test('Get all hand history pagination', async () => {
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.0.5');
    const player = await handutils.getPlayerById(playerId);
    const game1 = await gameutils.startGame(playerId, clubId, holdemGameInput);
    handData.GameNum = game1.gameId;
    handData.ClubId = clubId;
    handData.Result.pot_winners[0].winners[0].player = player;
    for (let i = 1; i < 17; i++) {
      handData.HandNum = i.toString();
      await axios.post(`${HANDSERVER_API}/save-hand`, handData);
    }
    const resp1 = await handutils.getAllHandHistory(
      playerId,
      clubId,
      game1.gameId
    );
    expect(resp1).toHaveLength(10);

    const lastHand = resp1[9];
    const resp2 = await handutils.getAllHandHistory(
      playerId,
      clubId,
      game1.gameId,
      {
        prev: lastHand.pageId,
        count: 5,
      }
    );
    expect(resp2).toHaveLength(5);
  });

  test('Get my winning hands', async () => {
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.0.6');
    const player = await handutils.getPlayerById(playerId);
    const game1 = await gameutils.startGame(playerId, clubId, holdemGameInput);
    handData.GameNum = game1.gameId;
    handData.ClubId = clubId;
    handData.Result.pot_winners[0].winners[0].player = player;
    for (let i = 1; i < 5; i++) {
      handData.HandNum = i.toString();
      await axios.post(`${HANDSERVER_API}/save-hand`, handData);
    }

    // try {
    const resp1 = await handutils.getMyWinningHands(
      playerId,
      clubId,
      game1.gameId
    );
    expect(resp1).toHaveLength(4);
    resp1.forEach(element => {
      expect(element.playerId).toBe(player);
    });
    // } catch (err) {
    //   expect(true).toBeFalsy();
    // }
  });

  test('Get my winning hands pagination', async () => {
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.0.7');
    const game1 = await gameutils.startGame(playerId, clubId, holdemGameInput);
    const player = await handutils.getPlayerById(playerId);
    handData.GameNum = game1.gameId;
    handData.ClubId = clubId;
    handData.Result.pot_winners[0].winners[0].player = player;
    for (let i = 1; i < 17; i++) {
      handData.HandNum = i.toString();
      await axios.post(`${HANDSERVER_API}/save-hand`, handData);
    }
    const resp1 = await handutils.getMyWinningHands(
      playerId,
      clubId,
      game1.gameId
    );
    expect(resp1).toHaveLength(10);
    resp1.forEach(element => {
      expect(element.playerId).toBe(player);
    });

    const lastHand = resp1[9];
    const resp2 = await handutils.getMyWinningHands(
      playerId,
      clubId,
      game1.gameId,
      {
        prev: lastHand.pageId,
        count: 5,
      }
    );
    expect(resp2).toHaveLength(5);
    resp2.forEach(element => {
      expect(element.playerId).toBe(player);
    });
  });

  test('Save starred hand', async () => {
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.0.8');
    const game1 = await gameutils.startGame(playerId, clubId, holdemGameInput);
    const player = await handutils.getPlayerById(playerId);
    handData.GameNum = game1.gameId;
    handData.ClubId = clubId;
    handData.Result.pot_winners[0].winners[0].player = player;
    handData.HandNum = '1';
    await axios.post(`${HANDSERVER_API}/save-hand`, handData);

    const resp = await handutils.saveStarredHand(
      clubId,
      game1.gameId,
      playerId,
      '1'
    );
    expect(resp).toBe('true');
  });

  test('Get starred hand', async () => {
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    await createGameServer('1.2.1.6');
    const player = await handutils.getPlayerById(playerId);
    const game1 = await gameutils.startGame(playerId, clubId, holdemGameInput);
    handData.GameNum = game1.gameId;
    handData.ClubId = clubId;
    handData.Result.pot_winners[0].winners[0].player = player;
    for (let i = 1; i < 30; i++) {
      handData.HandNum = i.toString();
      await axios.post(`${HANDSERVER_API}/save-hand`, handData);
      await handutils.saveStarredHand(clubId, game1.gameId, playerId, '1');
    }

    const resp = await handutils.getStarredHands(playerId);
    expect(resp.length).toBe(25);
  });
});
