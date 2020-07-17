import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {Club} from './club';
import {PokerGame} from './game';
import {DbAwareColumn} from './dbaware';

export enum PromotionType {
  HIGH_HAND,
  BAD_BEAT,
  SPECIFIC_CARDS,
}

@Entity({name: 'promotion'})
export class Promotion {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'club_id'})
  public clubId!: string;

  @Column({name: 'promotion_type'})
  public promotionType!: PromotionType;

  @Column({name: 'card_rank'})
  public cardRank!: number;

  @Column({type: 'decimal', name: 'bonus'})
  public bonus!: number;
}

@Entity({name: 'game_promotion'})
export class GamePromotion {
  @ManyToOne(() => Club, club => club.id, {primary: true})
  @JoinColumn({name: 'club_id'})
  public club!: Club;

  @ManyToOne(() => PokerGame, game => game.id, {primary: true})
  @JoinColumn({name: 'game_id'})
  public game!: PokerGame;

  @ManyToOne(() => Promotion, promo => promo.id, {primary: true})
  @JoinColumn({name: 'promo_id'})
  public promoId!: Promotion;

  @Column({name: 'one_time'})
  public oneTime!: boolean;

  @Column({name: 'hours'})
  public hours!: number;

  @Index()
  @DbAwareColumn({name: 'start_at', type: 'timestamp'})
  public startAt!: Date;

  @Index()
  @DbAwareColumn({name: 'end_at', type: 'timestamp'})
  public endAt!: Date;
}
