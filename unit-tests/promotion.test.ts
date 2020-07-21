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
          clubId: club,
          input: {
            cardRank: 5,
            bonus: 4,
            promotionType: 'HIGH_HAND',
          },
        },
        player
      );
      expect(promotion.id).not.toBe(null);
      expect(promotion.clubId).toBe(club);
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
          clubId: club,
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
          clubId: club,
          promotionId: promotion.id,
          gameId: game.gameId,
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
            clubId: club,
            input: {
              cardRank: 5,
              bonus: 4,
              promotionType: 'HIGH_HAND',
            },
          },
          player
        );
      }
      const promotions = await getPromotions({clubId: club}, player);
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
            clubId: club,
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
            clubId: club,
            promotionId: promotion.id,
            gameId: game.gameId,
            startAt: 1594919334244,
            endAt: 1594919334244,
          },
          player
        );
      }
      const promotions = await getAssignedPromotions(
        {clubId: club, gameId: game.gameId},
        player
      );
      expect(promotions).toHaveLength(20);
    } catch (err) {
      logger.error(JSON.stringify(err));
      expect(true).toBeFalsy();
    }
  });

  test('Save hand with promotion', async () => {
    // try{
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
    const gameId = (await getGameById(owner, game.gameId)).id;
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
        clubId: club,
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
        clubId: club,
        promotionId: promotion.id,
        gameId: game.gameId,
        startAt: 1594919334244,
        endAt: 1594919334244,
      },
      owner
    );
    handData.HandNum = '1';
    handData.GameNum = game.gameId;
    handData.ClubId = club;
    handData.Result.pot_winners[0].winners[0].player = playerId;
    handData.Result.summary[0].player = playerId;
    handData.Result.qualifying_promotion_winner.player_id = playerId;
    handData.Result.qualifying_promotion_winner.promo_id = promotion.id;
    handData.Result.qualifying_promotion_winner.rank = 4;
    const resp = await saveHandData(handData);
    expect(resp).toBe(true);
    handData.HandNum = '2';
    const resp1 = await saveHandData(handData);
    expect(resp1).toBe(true);
    handData.HandNum = '3';
    handData.Result.qualifying_promotion_winner.rank = 3;
    const resp2 = await saveHandData(handData);
    expect(resp2).toBe(true);
    // } catch (err) {
    //   logger.error(JSON.stringify(err));
    //   expect(true).toBeFalsy();
    // }
  });
});
