import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
import {
  DbAwareColumn,
  DbAwareCreateDateColumn,
  DbAwareUpdateDateColumn,
} from '../dbaware';
import {BuyInApprovalStatus, PlayerStatus} from '../types';

export enum StoreType {
  UNKNOWN,
  IOS_APP_STORE,
  GOOGLE_PLAY_STORE,
  STRIPE_PAYMENT,
}

@Entity({name: 'coin_purchase_transactions'})
export class CoinPurchaseTransaction {
  @PrimaryGeneratedColumn()
  public id!: number;

  // player who made the purchase
  @Index('coin-tran-player-uuid-idx')
  @Column({name: 'player_uuid'})
  public playerUuid!: string;

  @Column({name: 'product_id'})
  public productId!: string;

  @Column({name: 'store_type', type: 'int'})
  public storeType!: StoreType;

  @Column({name: 'server_data'})
  public serverData!: string;

  @Column({name: 'trans_id'})
  public transactionId!: string;

  @Column({name: 'refunded'})
  public refunded!: boolean;

  @Index('coin-tran-receipt-hash-idx')
  @Column({name: 'receipt_hash', nullable: true})
  public receiptHash!: string;

  @Column({name: 'coins_purchased', type: 'int'})
  public coinsPurchased!: number;

  @DbAwareColumn({name: 'purchase_date', type: 'timestamp'})
  public purchaseDate!: Date;
}

@Entity({name: 'player_coins'})
export class PlayerCoin {
  // player who made the purchase
  @PrimaryColumn({name: 'player_uuid'})
  public playerUuid!: string;

  @Column({name: 'total_coins_purchased', type: 'int'})
  public totalCoinsPurchased!: number;

  @Column({name: 'total_coins_available', type: 'int'})
  public totalCoinsAvailable!: number;

  /**
   * DB insert time.
   */
  @DbAwareCreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt!: Date;

  /**
   * DB last update time.
   */
  @DbAwareUpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;
}

@Entity({name: 'coin_consume_transactions'})
export class CoinConsumeTransaction {
  @PrimaryGeneratedColumn()
  public id!: number;

  // player who made the purchase
  @Index('coin-consume-player-id-idx')
  @Column({name: 'player_id', type: 'int'})
  public playerId!: number;

  // player who made the purchase
  @Index('coin-consume-player-uuid-idx')
  @Column({name: 'player_uuid'})
  public playerUuid!: string;

  @Column({name: 'game_code', nullable: true})
  public gameCode!: string;

  @Column({name: 'product_sku', nullable: true})
  public productSku!: string;

  @Column({name: 'diamonds', nullable: true, type: 'int'})
  public diamonds!: number;

  @Column({name: 'coins_spent', nullable: false, type: 'int'})
  public coinsSpent!: number;

  @DbAwareColumn({name: 'consumed_time', type: 'timestamp'})
  public purchaseDate!: Date;
}
