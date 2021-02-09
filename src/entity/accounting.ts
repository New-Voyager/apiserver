import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {Club} from './club';
import {DbAwareCreateDateColumn} from './dbaware';
import {PokerGame} from './game';
import {Player} from './player';
import {TransactionType, SubTransactionType} from './types';

@Entity({name: 'club_token_transactions'})
export class ClubTokenTransactions {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(() => Club, club => club.id)
  @JoinColumn({name: 'club'})
  public club!: Club;

  @ManyToOne(() => Player, player => player.id, {nullable: true})
  @JoinColumn({name: 'host'})
  public host!: Player;

  @ManyToOne(() => PokerGame, game => game.id, {nullable: true})
  @JoinColumn({name: 'game'})
  public game!: PokerGame;

  @ManyToOne(() => Player, player => player.id, {nullable: true})
  @JoinColumn({name: 'player'})
  public player!: Player;

  @Column({name: 'game_chip', type: 'decimal', nullable: true})
  public gameChip!: number;

  @Column({name: 'game_chip_unit', type: 'decimal', nullable: true})
  public gameChipUnit!: number;

  @Column({name: 'token', type: 'decimal'})
  public token!: number;

  @ManyToOne(() => Player, player => player.id, {nullable: true})
  @JoinColumn({name: 'other_player'})
  public otherPlayer!: Player;

  @Column({name: 'notes', nullable: true})
  public notes!: string;

  @Column({name: 'type', type: 'int'})
  public type!: TransactionType;

  @Column({name: 'sub_type', type: 'int', nullable: true})
  public subType!: SubTransactionType;

  @DbAwareCreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt!: Date;
}
