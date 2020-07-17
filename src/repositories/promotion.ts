import {Club} from '@src/entity/club';
import {Promotion, PromotionType, GamePromotion} from '@src/entity/promotion';
import {getRepository, MoreThan, LessThan} from 'typeorm';
import {ClubMessageType} from '../entity/clubmessage';
import {Player} from '@src/entity/player';
import {PageOptions} from '@src/types';
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
    clubId: string,
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
      where: {displayId: clubId, owner: player.id},
    });
    if (!club) {
      throw new Error(`Club ${clubId} is not found`);
    }
    const data = new Promotion();
    data.promotionType = parseInt(PromotionType[input.promotionType]);
    data.cardRank = input.cardRank;
    data.bonus = input.bonus;
    data.clubId = clubId;
    const repository = getRepository(Promotion);
    const response = await repository.save(data);
    return response;
  }

  public async assignPromotion(
    clubId: string,
    gameId: string,
    promotionId: number,
    startAt: Date,
    endAt: Date
  ): Promise<string | undefined> {
    try {
      const clubRepository = getRepository(Club);
      const gameRepository = getRepository(PokerGame);
      const promoRepository = getRepository(Promotion);
      const gamePromoRepository = getRepository(GamePromotion);
      const club = await clubRepository.findOne({where: {displayId: clubId}});
      const game = await gameRepository.findOne({where: {gameId: gameId}});
      const promo = await promoRepository.findOne({where: {id: promotionId}});
      if (!club) {
        throw new Error(`Club ${clubId} is not found`);
      }
      if (!game) {
        throw new Error(`Game ${gameId} is not found`);
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

  public async getPromotions(clubId: string): Promise<Array<any>> {
    try {
      const clubRepository = getRepository(Club);
      const promoRepository = getRepository(Promotion);
      const club = await clubRepository.findOne({where: {displayId: clubId}});
      if (!club) {
        throw new Error(`Club ${clubId} is not found`);
      }
      const promo = await promoRepository.find({where: {clubId: clubId}});
      if (!promo) {
        throw new Error('No promotions found');
      }
      return promo;
    } catch (e) {
      throw e;
    }
  }

  public async getAssignedPromotions(
    clubId: string,
    gameId: string
  ): Promise<Array<any>> {
    try {
      const clubRepository = getRepository(Club);
      const gameRepository = getRepository(PokerGame);
      const gamePromoRepository = getRepository(GamePromotion);
      const game = await gameRepository.findOne({where: {gameId: gameId}});
      const club = await clubRepository.findOne({where: {displayId: clubId}});
      if (!club) {
        throw new Error(`Club ${clubId} is not found`);
      }
      if (!game) {
        throw new Error(`Game ${gameId} is not found`);
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
