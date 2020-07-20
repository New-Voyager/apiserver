import {PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase, getClient} from './utils/utils';
import * as promotionutils from './utils/promotions.testutils';
import * as clubutils from './utils/club.testutils';
import * as gameutils from './utils/game.testutils';
import {getLogger} from '../src/utils/log';
import * as handutils from './utils/hand.testutils';
const logger = getLogger('promotion');

const SERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

const handData = {
  ClubId: '',
  GameNum: '',
  HandNum: '1',
  Players: [1000, 1001, 20001, 30001, 40001],
  GameType: 'HOLDEM',
  StartedAt: '2020-06-30T00:02:10',
  EndedAt: '2020-06-30T00:04:00',
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
    rake: 2.0,
    qualifying_promotion_winner: {
      promo_id: 123456,
      player_id: 1,
      cards: ['7h', '7s', '7c', 'Ks', 'Kh'],
      rank: 150,
    },
    summary: [
      {
        player: 1000,
        balance: 85.0,
        change: 0.0,
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

beforeAll(async done => {
  await resetDatabase();
  done();
});

afterAll(async done => {
  done();
});

describe('Promotion APIs', () => {
  test('Create a promotion', async () => {
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    const input = {
      cardRank: 5,
      bonus: 4,
      promotionType: 'HIGH_HAND',
    };
    const response = await getClient(playerId).mutate({
      variables: {
        clubId: clubId,
        input: input,
      },
      mutation: promotionutils.createPromotion,
    });
    expect(response.errors).toBeUndefined();
    expect(response.data).not.toBeUndefined();
    const promotion = response.data.data.id;
    expect(promotion).not.toBeNull();
    expect(promotion).not.toBeUndefined();
  });

  test('Assign a promotion', async () => {
    const gameServer = {
      ipAddress: '10.1.1.3',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      await axios.post(`${SERVER_API}/register-game-server`, gameServer);
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    const game = await gameutils.startGame(playerId, clubId, holdemGameInput);
    const input = {
      cardRank: 5,
      bonus: 4,
      promotionType: 'HIGH_HAND',
    };
    const promotion = await getClient(playerId).mutate({
      variables: {
        clubId: clubId,
        input: input,
      },
      mutation: promotionutils.createPromotion,
    });
    const response = await getClient(playerId).mutate({
      variables: {
        clubId: clubId,
        promotionId: promotion.data.data.id,
        gameId: game.gameId,
        startAt: 1594919334244,
        endAt: 1594919334244,
      },
      mutation: promotionutils.assignPromotion,
    });
    expect(response.errors).toBeUndefined();
    expect(response.data).not.toBeUndefined();
    expect(response.data.data).toBe('Assigned Successfully');
  });

  test('Get promotions', async () => {
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    const promotionCount = 20;
    const input = {
      cardRank: 5,
      bonus: 4,
      promotionType: 'HIGH_HAND',
    };
    for (let i = 0; i < promotionCount; i++) {
      await getClient(playerId).mutate({
        variables: {
          clubId: clubId,
          input: input,
        },
        mutation: promotionutils.createPromotion,
      });
    }

    const result = await promotionutils.getPromotion(clubId, playerId);
    expect(result).toHaveLength(20);
  });

  test('Get Assigned promotions', async () => {
    const promotionCount = 20;
    const gameServer = {
      ipAddress: '10.1.1.4',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      await axios.post(`${SERVER_API}/register-game-server`, gameServer);
    } catch (err) {
      console.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    const game = await gameutils.startGame(playerId, clubId, holdemGameInput);
    const input = {
      cardRank: 5,
      bonus: 4,
      promotionType: 'HIGH_HAND',
    };
    for (let i = 0; i < promotionCount; i++) {
      const promotion = await getClient(playerId).mutate({
        variables: {
          clubId: clubId,
          input: input,
        },
        mutation: promotionutils.createPromotion,
      });
      await getClient(playerId).mutate({
        variables: {
          clubId: clubId,
          promotionId: promotion.data.data.id,
          gameId: game.gameId,
          startAt: 1594919334244,
          endAt: 1594919334244,
        },
        mutation: promotionutils.assignPromotion,
      });
    }
    const result = await promotionutils.getAssignedPromotion(
      clubId,
      playerId,
      game.gameId
    );
    expect(result).toHaveLength(20);
  });

  test('Save hand with promotion', async () => {
    const promotionCount = 20;
    const gameServer = {
      ipAddress: '10.1.1.5',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await axios.post(`${SERVER_API}/register-game-server`, gameServer);
    const [clubId, playerId] = await clubutils.createClub('brady', 'yatzee');
    const game = await gameutils.startGame(playerId, clubId, holdemGameInput);
    const clubID = await clubutils.getClubById(clubId);
    const gameID = await gameutils.getGameById(game.gameId);
    const player = await handutils.getPlayerById(playerId);
    const messageInput = {
      clubId: clubID,
      playerId: player,
      gameId: gameID,
      buyIn: 100.0,
      status: 'PLAYING',
      seatNo: 1,
    };
    await axios.post(`${SERVER_API}/player-sit-in`, messageInput);
    const input = {
      cardRank: 5,
      bonus: 4,
      promotionType: 'HIGH_HAND',
    };
    const promotion = await getClient(playerId).mutate({
      variables: {
        clubId: clubId,
        input: input,
      },
      mutation: promotionutils.createPromotion,
    });
    await getClient(playerId).mutate({
      variables: {
        clubId: clubId,
        promotionId: promotion.data.data.id,
        gameId: game.gameId,
        startAt: 1594919334244,
        endAt: 1594919334244,
      },
      mutation: promotionutils.assignPromotion,
    });

    handData.HandNum = '1';
    handData.GameNum = game.gameId;
    handData.ClubId = clubId;
    handData.Result.pot_winners[0].winners[0].player = player;
    handData.Result.summary[0].player = player;
    handData.Result.qualifying_promotion_winner.player_id = player;
    handData.Result.qualifying_promotion_winner.promo_id =
      promotion.data.data.id;
    handData.Result.qualifying_promotion_winner.rank = 4;

    try {
      const resp = await axios.post(`${SERVER_API}/save-hand`, handData);
      expect(resp.status).toBe(200);
      expect(resp.data.status).toBe('OK');

      handData.HandNum = '2';
      const resp1 = await axios.post(`${SERVER_API}/save-hand`, handData);
      expect(resp1.status).toBe(200);
      expect(resp1.data.status).toBe('OK');

      handData.HandNum = '3';
      handData.Result.qualifying_promotion_winner.rank = 3;
      const resp3 = await axios.post(`${SERVER_API}/save-hand`, handData);
      expect(resp3.status).toBe(200);
      expect(resp3.data.status).toBe('OK');
    } catch (err) {
      expect(true).toBeFalsy();
    }
  });
});
