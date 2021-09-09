import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import {DbAwareCreateDateColumn, DbAwareUpdateDateColumn} from '../dbaware';
import {Player} from './player';
import {Promotion} from './promotion';

@Entity({name: 'promotion_consumed'})
@Unique(['player', 'promotion'])
export class PromotionConsumed {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(() => Player, player => player.id, {
    nullable: false,
    eager: true,
  })
  @JoinColumn({name: 'player_id'})
  public player!: Player;

  @ManyToOne(() => Promotion, promo => promo.id, {
    nullable: false,
    eager: true,
  })
  @JoinColumn({name: 'promotion_id'})
  public promotion!: Promotion;

  @Column()
  public awardedCoins!: number;

  /**
   * DB insert time.
   */
  @DbAwareCreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt!: Date;

  /**
   * DB last update time.
   */
  @DbAwareUpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;
}
