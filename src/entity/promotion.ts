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
import {Player} from './player';
import {PromotionType} from './types';

@Entity({name: 'promotion'})
export class Promotion {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'club_code'})
  public clubCode!: string;

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

@Entity({name: 'promotion_winners'})
export class PromotionWinners {
  @ManyToOne(() => Club, club => club.id, {primary: true})
  @JoinColumn({name: 'club_id'})
  public club!: Club;

  @ManyToOne(() => PokerGame, game => game.id, {primary: true})
  @JoinColumn({name: 'game_id'})
  public game!: PokerGame;

  @ManyToOne(() => Promotion, promo => promo.id, {primary: true})
  @JoinColumn({name: 'promo_id'})
  public promoId!: Promotion;

  @ManyToOne(() => Player, player => player.id, {primary: true})
  @JoinColumn({name: 'player_id'})
  public player!: Player;

  @Column({name: 'rank'})
  public rank!: number;

  @Column({name: 'hand_num'})
  public handNum!: number;

  @Column({name: 'winning_cards', type: 'text'})
  public winningCards!: string;

  @Column({name: 'amount_won', type: 'decimal', precision: 9, scale: 2})
  public amountWon!: number;
}
