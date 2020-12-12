import {PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase, getClient} from './utils/utils';
import * as promotionutils from './utils/promotions.testutils';
import * as clubutils from './utils/club.testutils';
import * as gameutils from './utils/game.testutils';
import {getLogger} from '../src/utils/log';
import * as handutils from './utils/hand.testutils';
const logger = getLogger('promotion');
import * as rewardutils from './utils/reward.testutils';
import {ScalarLeafs} from 'graphql/validation/rules/ScalarLeafs';

const SERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

const flopHandWithPromotions = {
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
    qualifyingPromotionWinner: {
      promoId: 123456,
      playerId: 1,
      cards: [200, 196, 8, 132, 1],
      cardsStr: '[ A♣  A♦  2♣  T♦  2♠ ]',
      rank: 150,
    },
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

beforeAll(async done => {
  await resetDatabase();
  done();
});

afterAll(async done => {
  done();
});

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

describe('Promotion APIs', () => {
  test('Create a promotion', async () => {
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    const input = {
      cardRank: 5,
      bonus: 4,
      promotionType: 'HIGH_HAND',
    };
    const response = await getClient(playerId).mutate({
      variables: {
        clubCode: clubCode,
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
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    saveReward(playerId, clubCode);
    const game = await gameutils.configureGame(
      playerId,
      clubCode,
      holdemGameInput
    );
    const input = {
      cardRank: 5,
      bonus: 4,
      promotionType: 'HIGH_HAND',
    };
    const promotion = await getClient(playerId).mutate({
      variables: {
        clubCode: clubCode,
        input: input,
      },
      mutation: promotionutils.createPromotion,
    });
    const response = await getClient(playerId).mutate({
      variables: {
        clubCode: clubCode,
        promotionId: promotion.data.data.id,
        gameCode: game.gameCode,
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
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    const promotionCount = 20;
    const input = {
      cardRank: 5,
      bonus: 4,
      promotionType: 'HIGH_HAND',
    };
    for (let i = 0; i < promotionCount; i++) {
      await getClient(playerId).mutate({
        variables: {
          clubCode: clubCode,
          input: input,
        },
        mutation: promotionutils.createPromotion,
      });
    }

    const result = await promotionutils.getPromotion(clubCode, playerId);
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
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    saveReward(playerId, clubCode);
    const game = await gameutils.configureGame(
      playerId,
      clubCode,
      holdemGameInput
    );
    const input = {
      cardRank: 5,
      bonus: 4,
      promotionType: 'HIGH_HAND',
    };
    for (let i = 0; i < promotionCount; i++) {
      const promotion = await getClient(playerId).mutate({
        variables: {
          clubCode: clubCode,
          input: input,
        },
        mutation: promotionutils.createPromotion,
      });
      await getClient(playerId).mutate({
        variables: {
          clubCode: clubCode,
          promotionId: promotion.data.data.id,
          gameCode: game.gameCode,
          startAt: 1594919334244,
          endAt: 1594919334244,
        },
        mutation: promotionutils.assignPromotion,
      });
    }
    const result = await promotionutils.getAssignedPromotion(
      clubCode,
      playerId,
      game.gameCode
    );
    expect(result).toHaveLength(20);
  });

  test('Save hand with promotion', async () => {
    const gameServer = {
      ipAddress: '10.1.1.5',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    await axios.post(`${SERVER_API}/register-game-server`, gameServer);
    const [clubCode, playerId] = await clubutils.createClub('brady', 'yatzee');
    saveReward(playerId, clubCode);
    const game = await gameutils.configureGame(
      playerId,
      clubCode,
      holdemGameInput
    );
    const clubID = await clubutils.getClubById(clubCode);
    const gameID = await gameutils.getGameById(game.gameCode);
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
        clubCode: clubCode,
        input: input,
      },
      mutation: promotionutils.createPromotion,
    });
    await getClient(playerId).mutate({
      variables: {
        clubCode: clubCode,
        promotionId: promotion.data.data.id,
        gameCode: game.gameCode,
        startAt: 1594919334244,
        endAt: 1594919334244,
      },
      mutation: promotionutils.assignPromotion,
    });

    flopHandWithPromotions.handNum = 1;
    flopHandWithPromotions.gameId = gameID;
    flopHandWithPromotions.clubId = clubID;
    flopHandWithPromotions.handResult.potWinners[0].hiWinners[0].seatNo = 1;
    flopHandWithPromotions.handResult.balanceAfterHand[0].playerId = player;
    flopHandWithPromotions.handResult.playersInSeats = [player];
    flopHandWithPromotions.handResult.qualifyingPromotionWinner.playerId = player;
    flopHandWithPromotions.handResult.qualifyingPromotionWinner.promoId =
      promotion.data.data.id;
    flopHandWithPromotions.handResult.qualifyingPromotionWinner.rank = 4;

    try {
      const resp = await axios.post(
        `${SERVER_API}/save-hand`,
        flopHandWithPromotions
      );
      expect(resp.status).toBe(200);
      expect(resp.data.status).toBe('OK');

      flopHandWithPromotions.handNum = 2;
      const resp1 = await axios.post(
        `${SERVER_API}/save-hand`,
        flopHandWithPromotions
      );
      expect(resp1.status).toBe(200);
      expect(resp1.data.status).toBe('OK');

      flopHandWithPromotions.handNum = 3;
      flopHandWithPromotions.handResult.qualifyingPromotionWinner.rank = 3;
      const resp3 = await axios.post(
        `${SERVER_API}/save-hand`,
        flopHandWithPromotions
      );
      expect(resp3.status).toBe(200);
      expect(resp3.data.status).toBe('OK');
    } catch (err) {
      expect(true).toBeFalsy();
    }
  });
});
