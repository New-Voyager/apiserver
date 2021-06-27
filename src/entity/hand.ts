import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {Club} from './club';
import {DbAwareColumn, DbAwareUpdateDateColumn} from './dbaware';
import {PokerGame} from './game';
import {Player} from './player';
import {GameType, WonAtStatus} from './types';

@Entity({name: 'hand_history'})
export class HandHistory {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index()
  @Column({name: 'game_id'})
  public gameId!: number;

  @Column({name: 'hand_num'})
  public handNum!: number;

  @Column({name: 'game_type'})
  public gameType!: GameType;

  @Column({name: 'won_at', type: 'int'})
  public wonAt!: WonAtStatus;

  @Column({name: 'show_down'})
  public showDown!: boolean;

  @Column({name: 'winning_cards', nullable: true})
  public winningCards!: string;

  @Column({name: 'winning_rank', type: 'int', nullable: true})
  public winningRank!: number;

  @Column({name: 'lo_winning_cards', nullable: true})
  public loWinningCards!: string;

  @Column({name: 'lo_winning_rank', type: 'int', nullable: true})
  public loWinningRank!: number;

  @Column({name: 'players', nullable: true})
  public players!: string;

  @Index()
  @DbAwareColumn({name: 'time_started', type: 'timestamp'})
  public timeStarted!: Date;

  @Index()
  @DbAwareColumn({name: 'time_ended', type: 'timestamp'})
  public timeEnded!: Date;

  @DbAwareColumn({name: 'data', type: 'text'})
  public data!: string;

  @Column({name: 'total_pot', type: 'float', default: 0, nullable: true})
  public totalPot!: number;

  @Column({name: 'rake', type: 'float', default: 0, nullable: true})
  public rake!: number;

  @Column({name: 'player_paid_rake', type: 'int', nullable: true})
  public playerPaidRake!: number;

  @DbAwareColumn({name: 'players_stack', type: 'text', nullable: true})
  public playersStack!: string;

  // summary is used for showing in the hand history view
  @DbAwareColumn({name: 'summary', type: 'text', nullable: true})
  public summary!: string;

  @Column({name: 'hand_time', type: 'int', default: 0, nullable: true})
  public handTime!: number;
}

@Entity({name: 'saved_hands'})
export class SavedHands {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(() => Player, sharedBy => sharedBy.id, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({name: 'shared_by'})
  public sharedBy!: Player;

  @ManyToOne(() => Player, savedBy => savedBy.id, {nullable: true, eager: true})
  @JoinColumn({name: 'saved_by'})
  public savedBy!: Player;

  @ManyToOne(() => Club, sharedTo => sharedTo.id, {nullable: true})
  @JoinColumn({name: 'shared_to'})
  public sharedTo!: Club;

  @Column({name: 'game_code'})
  public gameCode!: string;

  @Column({name: 'game_type'})
  public gameType!: GameType;

  @Column({name: 'hand_num', type: 'int'})
  public handNum!: number;

  @Column({name: 'data', type: 'text'})
  public data!: string;

  @DbAwareUpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;
}
