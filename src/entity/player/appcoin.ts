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

@Entity({name: 'coin_transactions'})
export class CoinTransaction {
  @PrimaryGeneratedColumn()
  public id!: number;

  // player who made the purchase
  @Index('coin-tran-uuid-idx')
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

  @Index('coin-tran-receipt-hash')
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
