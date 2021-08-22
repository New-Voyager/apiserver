import {Player} from '@src/entity/player/player';
import {Promotion} from '@src/entity/player/promotion';
import {PromotionConsumed} from '@src/entity/player/promotion_consumed';
import {getLogger} from '@src/utils/log';
import {getUserRepository} from '.';

const logger = getLogger('promotion');
class PromotionConsumedRepositoryImpl {
  public async isAlreadyConsumed(
    player: Player,
    promotion: Promotion
  ): Promise<boolean> {
    const repository = getUserRepository(PromotionConsumed);
    const promotionConsumed = await repository.findOne({
      where: {
        player: player,
        promotion: promotion,
      },
    });
    return promotionConsumed ? true : false;
  }

  public async createPromotionConsumed(promotion: Promotion, player: Player) {
    const repository = getUserRepository(PromotionConsumed);
    const promotionConsumed: PromotionConsumed = new PromotionConsumed();
    promotionConsumed.player = player;
    promotionConsumed.promotion = promotion;
    promotionConsumed.awardedCoins = promotion.coins;
    await repository.save(promotionConsumed);
  }
}

export const PromotionConsumedRepository = new PromotionConsumedRepositoryImpl();
