import { getLogger } from '../src/utils/log';
import {initializeSqlLite} from './utils';
import {resetDB} from '../src/resolvers/reset';
import {PromotionRepository} from '../src/repositories/promotion';
import { createPlayer } from '../src/resolvers/player';
import { ReedeemPromotionError } from '../src/repositories/types';
import { AppCoinRepository } from '../src/repositories/appcoin';

const logger = getLogger('unittest:promotion');


const players = [
  {
    name: "player1",
    deviceId: "player1",
    isBot: false,
  },
  {
    name: "player2",
    deviceId: "player2",
    isBot: false,
  },
  {
    name: "player3",
    deviceId: "player3",
    isBot: false,
  },
  {
    name: "selva",
    deviceId: "selva",
    isBot: false,
  },

]

async function createPlayers() {
  for(const player of players) {
    await createPlayer({player: player});
  }
}

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

  test('promotion: player promotion (assigned to specific player)', async () => {
    await createPlayers();
    const promotionCode = 'SELVA1000';
    await PromotionRepository.createPromotion('Selva 1000 Coins', promotionCode, 1000, 'selva', 0, null);
    let resp = await PromotionRepository.redeemPromotionCode('player1', promotionCode);
    expect(resp.error).toEqual(ReedeemPromotionError.PROMOTION_UNAUTHORIZED);
    resp = await PromotionRepository.redeemPromotionCode('selva', promotionCode);
    expect(resp.error).toBeUndefined();
    expect(resp.success).toBeTruthy();
    expect(resp.availableCoins).toEqual(1000);
    resp = await PromotionRepository.redeemPromotionCode('selva', promotionCode);
    expect(resp.error).toEqual(ReedeemPromotionError.PROMOTION_CONSUMED);

    const promotionCode2 = 'PLAYER1500';
    await PromotionRepository.createPromotion('Player 1 Coins', promotionCode2, 500, 'player1', 0, null);
    resp = await PromotionRepository.redeemPromotionCode('player1', promotionCode2);
    expect(resp.error).toBeUndefined();
    expect(resp.success).toBeTruthy();
    expect(resp.availableCoins).toEqual(500);
  });

  test('promotion: time promotion', async () => {
    await createPlayers();

    // consume expired promotion (should fail)
    const promotionCode = 'JUL2021';
    const july2021: Date | null = new Date(Date.parse('2021-07-31'));
    await PromotionRepository.createPromotion('July 2021', promotionCode, 1000, '', 0, july2021);
    let resp = await PromotionRepository.redeemPromotionCode('player1', promotionCode);
    expect(resp.success).toBeFalsy();
    expect(resp.error).toEqual(ReedeemPromotionError.PROMOTION_EXPIRED);

    const promotion2022 = 'DEC2022';
    const dec2022: Date | null = new Date(Date.parse('2022-12-31'));
    await PromotionRepository.createPromotion('Dec 2022', promotion2022, 1000, '', 0, dec2022);
    resp = await PromotionRepository.redeemPromotionCode('player1', promotion2022);
    expect(resp.success).toBeTruthy();
    expect(resp.error).toBeUndefined();
    expect(resp.availableCoins).toEqual(1000);
    let coins = await AppCoinRepository.availableCoins('player1');
    expect(coins).toEqual(1000);

    // consume with another player (should succeed)
    coins = await AppCoinRepository.availableCoins('selva');
    expect(coins).toEqual(0);
    resp = await PromotionRepository.redeemPromotionCode('selva', promotion2022);
    expect(resp.success).toBeTruthy();
    expect(resp.error).toBeUndefined();
    expect(resp.availableCoins).toEqual(1000);
    coins = await AppCoinRepository.availableCoins('selva');
    expect(coins).toEqual(1000);

    // try to consume again (should fail)
    resp = await PromotionRepository.redeemPromotionCode('selva', promotion2022);
    expect(resp.success).toBeFalsy();
    expect(resp.error).toEqual(ReedeemPromotionError.PROMOTION_CONSUMED);
    coins = await AppCoinRepository.availableCoins('selva');
    expect(coins).toEqual(1000);
  });

  test('promotion: count promotion', async () => {
    await createPlayers();

    // consume expired promotion (should fail)
    const promotionCode = '100COINS3';
    await PromotionRepository.createPromotion('July 2021', promotionCode, 100, '', 3, null);
    let resp = await PromotionRepository.redeemPromotionCode('player1', promotionCode);
    expect(resp.success).toBeTruthy();
    expect(resp.error).toBeUndefined();
    expect(resp.availableCoins).toEqual(100);
    
    resp = await PromotionRepository.redeemPromotionCode('player2', promotionCode);
    expect(resp.success).toBeTruthy();
    expect(resp.error).toBeUndefined();
    expect(resp.availableCoins).toEqual(100);
    resp = await PromotionRepository.redeemPromotionCode('player2', promotionCode);
    expect(resp.success).toBeFalsy();
    expect(resp.error).toEqual(ReedeemPromotionError.PROMOTION_CONSUMED);
    
    resp = await PromotionRepository.redeemPromotionCode('player3', promotionCode);
    expect(resp.success).toBeTruthy();
    expect(resp.error).toBeUndefined();
    expect(resp.availableCoins).toEqual(100);

    resp = await PromotionRepository.redeemPromotionCode('selva', promotionCode);
    expect(resp.success).toBeFalsy();
    expect(resp.error).toEqual(ReedeemPromotionError.PROMOTION_MAX_LIMIT_REACHED);
  });
});