import {PORT_NUMBER} from './utils/utils';
import {default as axios} from 'axios';
import {resetDatabase, getClient} from './utils/utils';
import * as promotionutils from './utils/promotions.testutils';
import * as clubutils from './utils/club.testutils';
import * as gameutils from './utils/game.testutils';
import {getLogger} from '../src/utils/log';
const logger = getLogger('promotion');

const SERVER_API = `http://localhost:${PORT_NUMBER}/internal`;

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
});
