import {PlayerCoin} from '@src/entity/player/appcoin';
import {Player} from '@src/entity/player/player';
import {Promotion} from '@src/entity/player/promotion';
import {getLogger} from '@src/utils/log';
import {getUserRepository} from '.';
import {Cache} from '@src/cache';
import {RedeemPromotionResult, ReedeemPromotionError} from './types';
import {AppCoinRepository} from './appcoin';
import {PromotionConsumedRepository} from './promotion_consumed';
import {PlayerRepository} from './player';
import {PromotionConsumed} from '@src/entity/player/promotion_consumed';

const logger = getLogger('admin_promotion');

class PromotionRepositoryImpl {
  public async findAll() {
    const repository = getUserRepository(Promotion);
    const promotions = await repository.find();
    return promotions;
  }

  public async deleteAll() {
    await getUserRepository(PromotionConsumed).delete({});
    const repository = getUserRepository(Promotion);
    await repository.delete({});
  }

  public async createPromotion(
    name: string,
    code: string,
    coins: number,
    playerId: string,
    maxCount: number,
    expiresAt: Date
  ): Promise<Promotion> {
    const repository = getUserRepository(Promotion);
    const promotion = new Promotion();
    promotion.name = name;
    promotion.code = code;
    promotion.coins = coins;
    promotion.maxCount = maxCount;
    promotion.expiresAt = expiresAt;

    if (playerId) {
      const player = await Cache.getPlayer(playerId);
      promotion.player = player;
    }
    return await repository.save(promotion);
  }

  public async redeemPromotionCode(
    playerId: string,
    code: string
  ): Promise<RedeemPromotionResult> {
    //find promotion
    const repository = getUserRepository(Promotion);
    const promotion = await repository.findOne({where: {code: code}});
    logger.debug(`redeeming promotion=${promotion}`);
    const player = await Cache.getPlayer(playerId);
    let availableCoins = await AppCoinRepository.availableCoins(playerId);

    //if promotion not found return error
    if (!promotion) {
      return {
        success: false,
        availableCoins: availableCoins,
        error: ReedeemPromotionError.PROMOTION_INVALID,
      };
    }

    //promotion has a playerId and not matching the authrorized user
    if (promotion.player && playerId !== promotion.player.uuid) {
      return {
        success: false,
        availableCoins: availableCoins,
        error: ReedeemPromotionError.PROMOTION_UNAUTHORIZED,
      };
    }

    //if promotion has an expiry date
    if (promotion.expiresAt) {
      const diff = Date.now() - promotion.expiresAt.getTime();
      if (diff > 0) {
        return {
          success: false,
          availableCoins: availableCoins,
          error: ReedeemPromotionError.PROMOTION_EXPIRED,
        };
      }
    }

    //promotion has max limit & reached
    if (promotion.maxCount && promotion.usedCount > promotion.maxCount) {
      return {
        success: false,
        availableCoins: availableCoins,
        error: ReedeemPromotionError.PROMOTION_MAX_LIMIT_REACHED,
      };
    }

    //if promotion already consumed by authenticated player
    const consumed = await PromotionConsumedRepository.isAlreadyConsumed(
      player,
      promotion
    );
    if (consumed) {
      return {
        success: false,
        availableCoins: availableCoins,
        error: ReedeemPromotionError.PROMOTION_CONSUMED,
      };
    }

    //redeem promotion
    if (promotion.player || promotion.maxCount || promotion.expiresAt) {
      const updatedCoins = await AppCoinRepository.addCoins(
        0,
        promotion.coins,
        playerId
      );
      PromotionConsumedRepository.createPromotionConsumed(promotion, player);
      promotion.usedCount = promotion.usedCount + 1;
      repository.save(promotion);
      return {
        success: true,
        availableCoins: updatedCoins,
      };
    } else {
      return {
        success: false,
        availableCoins: availableCoins,
        error: ReedeemPromotionError.PROMOTION_INVALID,
      };
    }
  }
}

export const PromotionRepository = new PromotionRepositoryImpl();
/**
 * 
    //if promotion has a player id
    if( promotion.player){
      if(playerId !== promotion.player.uuid){ // it is not matching the authorized playerId
        return {
          success: false,
          availableCoins:availableCoins,
          error : ReedeemPromotionError.PROMOTION_INVALID
        };
      
      }else{
        const updatedCoins = await AppCoinRepository.addCoins(0,promotion.coins,playerId);
        PromotionConsumedRepository.createPromotionConsumed(promotion, player);
        promotion.usedCount = promotion.usedCount + 1;
        repository.save(promotion);

        return {
          success: true,
          availableCoins: updatedCoins,
        };
      }
    }else if (promotion.maxCount){  //if promotion has a max count
      return {
        success: false,
        availableCoins:availableCoins,
        error : ReedeemPromotionError.PROMOTION_INVALID
      }
    }else{
      return {
        success: false,
        availableCoins:availableCoins,
        error : ReedeemPromotionError.PROMOTION_INVALID
      }
    }
 */
