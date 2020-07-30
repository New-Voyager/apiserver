import {initializeSqlLite} from './utils';
import {createGameServer} from '@src/internal/gameserver';
import {getLogger} from '../src/utils/log';
import {resetDB} from '@src/resolvers/reset';
import {createPlayer, getPlayerById} from '@src/resolvers/player';
import {createClub, getClubById} from '@src/resolvers/club';
import {startGame, getGameById} from '@src/resolvers/game';
import {saveChipsData} from '@src/internal/chipstrack';
import {saveHandData} from '@src/internal/hand';
import {
  createPromotion,
  assignPromotion,
  getPromotions,
  getAssignedPromotions,
} from '@src/resolvers/promotion';

const logger = getLogger('game unit-test');
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

const flopHandWithPromotions = {
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
    qualifyingPromotionWinner: {
      promoId: 123456,
      playerId: 1,
      cards: [200, 196, 8, 132, 1],
      cardsStr: '[ A♣  A♦  2♣  T♦  2♠ ]',
      rank: 150,
    },
  },
};

beforeAll(async done => {
  await initializeSqlLite();
  done();
});

afterAll(async done => {
  done();
});

describe('Promotion APIs', () => {
  beforeEach(async done => {
    await resetDB();
    done();
  });

  afterEach(async done => {
    done();
  });

  test('Create a promotion', async () => {
    try {
      const player = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const club = await createClub(player, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: player,
      });
      const promotion = await createPromotion(
        {
          clubCode: club,
          input: {
            cardRank: 5,
            bonus: 4,
            promotionType: 'HIGH_HAND',
          },
        },
        player
      );
      expect(promotion.id).not.toBe(null);
      expect(promotion.clubCode).toBe(club);
      expect(promotion.promotionType).toBe(0);
      expect(promotion.cardRank).toBe(5);
      expect(promotion.bonus).toBe(4);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Assign a promotion', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.1',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      await createGameServer(gameServer1);
      const player = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const club = await createClub(player, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: player,
      });
      const game = await startGame(player, club, holdemGameInput);
      const promotion = await createPromotion(
        {
          clubCode: club,
          input: {
            cardRank: 5,
            bonus: 4,
            promotionType: 'HIGH_HAND',
          },
        },
        player
      );
      const resp = await assignPromotion(
        {
          clubCode: club,
          promotionId: promotion.id,
          gameCode: game.gameCode,
          startAt: 1594919334244, 
          endAt: 1594919334244,
        },
        player
      );
      expect(resp).toBe('Assigned Successfully');
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get promotions', async () => {
    try {
      const player = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const club = await createClub(player, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: player,
      });
      for (let i = 0; i < 20; i++) {
        await createPromotion(
          {
            clubCode: club,
            input: {
              cardRank: 5,
              bonus: 4,
              promotionType: 'HIGH_HAND',
            },
          },
          player
        );
      }
      const promotions = await getPromotions({clubCode: club}, player);
      expect(promotions).toHaveLength(20);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Get assigned promotions', async () => {
    const gameServer1 = {
      ipAddress: '10.1.1.2',
      currentMemory: 100,
      status: 'ACTIVE',
    };
    try {
      await createGameServer(gameServer1);
      const player = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc123',
        },
      });
      const club = await createClub(player, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: player,
      });
      const game = await startGame(player, club, holdemGameInput);
      for (let i = 0; i < 20; i++) {
        const promotion = await createPromotion(
          {
            clubCode: club,
            input: {
              cardRank: 5,
              bonus: 4,
              promotionType: 'HIGH_HAND',
            },
          },
          player
        );
        await assignPromotion(
          {
            clubCode: club,
            promotionId: promotion.id,
            gameCode: game.gameCode,
            startAt: 1594919334244,
            endAt: 1594919334244,
          },
          player
        );
      }
      const promotions = await getAssignedPromotions(
        {clubCode: club, gameCode: game.gameCode},
        player
      );
      expect(promotions).toHaveLength(20);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Save hand with promotion', async () => {
    try {
      const owner = await createPlayer({
        player: {
          name: 'player_name',
          deviceId: 'abc',
        },
      });
      expect(owner).not.toBeNull();
      const club = await createClub(owner, {
        name: 'club_name',
        description: 'poker players gather',
        ownerUuid: owner,
      });
      expect(club).not.toBeNull();
      const gameServer = {
        ipAddress: '10.1.1.1',
        currentMemory: 100,
        status: 'ACTIVE',
      };
      await createGameServer(gameServer);
      const game = await startGame(owner, club, holdemGameInput);
      const playerId = (await getPlayerById(owner)).id;
      const gameId = (await getGameById(owner, game.gameCode)).id;
      const clubId = (await getClubById(owner, club)).id;
      const messageInput = {
        clubId: clubId,
        playerId: playerId,
        gameId: gameId,
        buyIn: 100.0,
        status: 'PLAYING',
        seatNo: 1,
      };
      await saveChipsData(messageInput);
      const promotion = await createPromotion(
        {
          clubCode: club,
          input: {
            cardRank: 5,
            bonus: 4,
            promotionType: 'HIGH_HAND',
          },
        },
        owner
      );
      await assignPromotion(
        {
          clubCode: club,
          promotionId: promotion.id,
          gameCode: game.gameCode,
          startAt: 1594919334244,
          endAt: 1594919334244,
        },
        owner
      );
      flopHandWithPromotions.handNum = 1;
      flopHandWithPromotions.gameNum = gameId;
      flopHandWithPromotions.clubId = clubId;
      flopHandWithPromotions.handResult.potWinners[0].hiWinners[0].seatNo = 1;
      flopHandWithPromotions.handResult.balanceAfterHand[0].playerId = playerId;
      flopHandWithPromotions.handResult.playersInSeats = [playerId];
      flopHandWithPromotions.handResult.qualifyingPromotionWinner.playerId = playerId;
      flopHandWithPromotions.handResult.qualifyingPromotionWinner.promoId =
        promotion.id;
      flopHandWithPromotions.handResult.qualifyingPromotionWinner.rank = 4;

      const resp = await saveHandData(flopHandWithPromotions);
      expect(resp).toBe(true);

      flopHandWithPromotions.handNum = 2;
      const resp1 = await saveHandData(flopHandWithPromotions);
      expect(resp1).toBe(true);

      flopHandWithPromotions.handNum = 3;
      flopHandWithPromotions.handResult.qualifyingPromotionWinner.rank = 3;
      const resp2 = await saveHandData(flopHandWithPromotions);
      expect(resp2).toBe(true);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });
});
