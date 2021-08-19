import { Player } from '@src/entity/player/player';
import {Promotion} from '@src/entity/player/promotion';
import { saveReward } from '@src/resolvers/reward';
import {truncate} from 'fs';
import {getUserRepository} from '.';
import {RedeemPromotionResult} from './types';

class PromotionConsumedRepositoryImpl {
 
}

export const PromotionConsumedRepository = new PromotionConsumedRepositoryImpl();
