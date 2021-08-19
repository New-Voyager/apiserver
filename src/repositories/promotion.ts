import { PlayerCoin } from '@src/entity/player/appcoin';
import { Player } from '@src/entity/player/player';
import {Promotion} from '@src/entity/player/promotion';
import { getLogger } from '@src/utils/log';
import {getUserRepository} from '.';
import {RedeemPromotionResult, ReedeemError} from './types';

const logger = getLogger('admin_promotion');

class PromotionRepositoryImpl {

  static PROMOTION_INVALID = "PROMOTION_INVALID";

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
    if (playerId){
      const player = await this.getPlayer(playerId);
      promotion.player = player;
    }else{
      promotion.maxCount = maxCount;
      promotion.expiresAt = expiresAt;
    }
    return await repository.save(promotion);
  }


  public async redeemPromotionCode(
    playerId: string,
    code: string
  ): Promise<RedeemPromotionResult> {
    const repository = getUserRepository(Promotion);
    const promotion = await repository.findOne({where: {code: code}});
   
    if(!promotion){
      const result: RedeemPromotionResult = {
        success: false,
        availableCoins:0,
        error: PromotionRepositoryImpl.PROMOTION_INVALID
      };
      return result;
    }
    if(playerId!==promotion.player.uuid){
      throw new Error('')
    }
    const rpr: RedeemPromotionResult = {
      success: true,
      availableCoins: 10
    };
    return rpr;
  }

  private async getPlayerCoin(promotion: Promotion, playerId: string): Promise<PlayerCoin> {
    const repository = getUserRepository(PlayerCoin);
    const existingRow = await repository.findOne( {
      where: {
        playerUuid: playerId
      }
    });
    if (!existingRow){
      const playerCoin: PlayerCoin = new PlayerCoin();
      playerCoin.playerUuid = playerId;
      playerCoin.totalCoinsAvailable = promotion.coins;
      return await repository.save(playerCoin);
    }else{
      const updateResult = await repository.createQueryBuilder()
          .update()
          .set({
            totalCoinsAvailable: ()=>
              `total_coins_available + ${promotion.coins}`
          })
          .where({
            playerUuid: playerId
          })
          .execute();
          return existingRow;
    }
     

  }
  private async getPlayer(playerId: string):Promise<Player> {
    const repository = getUserRepository(Player);
    const player  = await repository.findOne({ where: { uuid: playerId}});
    if( player ){
      return player;
    }else{
      throw new Error('Player not found.');
    }
  }

}

export const PromotionRepository = new PromotionRepositoryImpl();
