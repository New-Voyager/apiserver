import {Club} from '@src/entity/club';
import {Promotion, GamePromotion} from '@src/entity/promotion';
import {PromotionType} from '@src/entity/types';
import {getRepository} from 'typeorm';
import {Player} from '@src/entity/player';
import {getLogger} from '@src/utils/log';
import {PokerGame} from '@src/entity/game';
const logger = getLogger('promotion');

export interface PromotionCreateInput {
  promotionType: PromotionType;
  cardRank: number;
  bonus: number;
}

class PromotionRepositoryImpl {
  public async createPromotion(
    clubCode: string,
    input: PromotionCreateInput,
    ownerId: string
  ): Promise<Promotion | undefined> {
    const playerRepository = getRepository<Player>(Player);
    const player = await playerRepository.findOne({where: {uuid: ownerId}});
    if (!player) {
      throw new Error(`Player ${ownerId} is not found`);
    }
    const clubRepository = getRepository(Club);
    const club = await clubRepository.findOne({
      where: {clubCode: clubCode, owner: player.id},
    });
    if (!club) {
      throw new Error(`Club ${clubCode} is not found`);
    }
    const data = new Promotion();
    data.promotionType = parseInt(PromotionType[input.promotionType]);
    data.cardRank = input.cardRank;
    data.bonus = input.bonus;
    data.clubCode = clubCode;
    const repository = getRepository(Promotion);
    const response = await repository.save(data);
    return response;
  }

  public async assignPromotion(
    clubCode: string,
    gameCode: string,
    promotionId: number,
    startAt: Date,
    endAt: Date
  ): Promise<string | undefined> {
    try {
      const clubRepository = getRepository(Club);
      const gameRepository = getRepository(PokerGame);
      const promoRepository = getRepository(Promotion);
      const gamePromoRepository = getRepository(GamePromotion);
      const club = await clubRepository.findOne({where: {clubCode: clubCode}});
      const game = await gameRepository.findOne({where: {gameCode: gameCode}});
      const promo = await promoRepository.findOne({where: {id: promotionId}});
      if (!club) {
        throw new Error(`Club ${clubCode} is not found`);
      }
      if (!game) {
        throw new Error(`Game ${gameCode} is not found`);
      }
      if (!promo) {
        throw new Error(`Promotion ${promotionId} is not found`);
      }
      const gamePromo = await gamePromoRepository.findOne({
        where: {club: club.id, game: game.id, promoId: promo.id},
      });
      if (gamePromo) {
        throw new Error('Promotion already assigned');
      }
      const data = new GamePromotion();
      data.club = club;
      data.game = game;
      data.promoId = promo;
      data.oneTime = true;
      data.hours = 1;
      data.startAt = new Date(startAt);
      data.endAt = new Date(endAt);
      const repository = getRepository(GamePromotion);
      const response = await repository.save(data);
      return 'Assigned Successfully';
    } catch (e) {
      throw e;
    }
  }

  public async getPromotions(clubCode: string): Promise<Array<any>> {
    try {
      const clubRepository = getRepository(Club);
      const promoRepository = getRepository(Promotion);
      const club = await clubRepository.findOne({where: {clubCode: clubCode}});
      if (!club) {
        throw new Error(`Club ${clubCode} is not found`);
      }
      const promo = await promoRepository.find({where: {clubCode: clubCode}});
      if (!promo) {
        throw new Error('No promotions found');
      }
      return promo;
    } catch (e) {
      throw e;
    }
  }

  public async getAssignedPromotions(
    clubCode: string,
    gameCode: string
  ): Promise<Array<any>> {
    try {
      const clubRepository = getRepository(Club);
      const gameRepository = getRepository(PokerGame);
      const gamePromoRepository = getRepository(GamePromotion);
      const game = await gameRepository.findOne({where: {gameCode: gameCode}});
      const club = await clubRepository.findOne({where: {clubCode: clubCode}});
      if (!club) {
        throw new Error(`Club ${clubCode} is not found`);
      }
      if (!game) {
        throw new Error(`Game ${gameCode} is not found`);
      }
      const gamePromo = await gamePromoRepository.find({
        relations: ['club', 'game', 'promoId'],
        where: {club: club.id, game: game.id},
      });
      if (!gamePromo) {
        throw new Error('No promotions found');
      }
      return gamePromo;
    } catch (e) {
      throw e;
    }
  }
}

export const PromotionRepository = new PromotionRepositoryImpl();
