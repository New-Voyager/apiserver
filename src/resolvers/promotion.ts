import * as _ from 'lodash';
import {PromotionType} from '@src/entity/promotion';
import {getLogger} from '@src/utils/log';
import {
  PromotionRepository,
  PromotionCreateInput,
} from '@src/repositories/promotion';
const logger = getLogger('promotion');

export async function createPromotion(
  args: any,
  playerUuid: string
): Promise<any> {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (!args.clubCode) {
    errors.push('clubCode not found');
  }
  if (!args.input) {
    errors.push('Promotion input is not found');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  try {
    const input = args.input as PromotionCreateInput;
    return PromotionRepository.createPromotion(
      args.clubCode,
      input,
      playerUuid
    );
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error('Failed to create the promotion');
  }
}

export async function assignPromotion(
  args: any,
  playerUuid: string
): Promise<any> {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (!args.clubCode) {
    errors.push('clubCode not found');
  }
  if (!args.promotionId) {
    errors.push('PromotionId not found');
  }
  if (!args.gameCode) {
    errors.push('gameCode not found');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  try {
    return PromotionRepository.assignPromotion(
      args.clubCode,
      args.gameCode,
      args.promotionId,
      args.startAt,
      args.endAt
    );
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error('Failed to create the promotion');
  }
}

export async function getPromotions(args: any, playerUuid: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (!args.clubCode) {
    errors.push('clubCode not found');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const data = await PromotionRepository.getPromotions(args.clubCode);
    logger.debug(data);
    return _.map(data, x => {
      return {
        id: x.id,
        clubCode: x.clubCode,
        bonus: x.bonus,
        cardRank: x.cardRank,
        promotionType: PromotionType[x.promotionType],
      };
    });
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error('Failed to retreive the promotions');
  }
}

export async function getAssignedPromotions(args: any, playerUuid: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (!args.clubCode) {
    errors.push('clubCode not found');
  }
  if (!args.gameCode) {
    errors.push('gameCode not found');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const data = await PromotionRepository.getAssignedPromotions(
      args.clubCode,
      args.gameCode
    );
    return _.map(data, x => {
      logger.debug(x);
      return {
        promotionId: x.promoId.id,
        clubCode: x.club.clubCode,
        gameCode: x.game.gameCode,
        cardRank: x.promoId.cardRank,
        bonus: x.promoId.bonus,
        startAt: x.startAt,
        endAt: x.endAt,
        promotionType: PromotionType[x.promoId.promotionType],
      };
    });
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error('Failed to retreive the promotions');
  }
}

const resolvers: any = {
  Query: {
    promotions: async (parent, args, ctx, info) => {
      return getPromotions(args, ctx.req.playerId);
    },

    assignedPromotions: async (parent, args, ctx, info) => {
      return getAssignedPromotions(args, ctx.req.playerId);
    },
  },
  Mutation: {
    createPromotion: async (parent, args, ctx, info) => {
      return createPromotion(args, ctx.req.playerId);
    },

    assignPromotion: async (parent, args, ctx, info) => {
      return assignPromotion(args, ctx.req.playerId);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
