import {Entity, PrimaryGeneratedColumn, Column, Index} from 'typeorm';
import {DbAwareColumn} from '../dbaware';
import {GameType, WonAtStatus} from '../types';

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

  @DbAwareColumn({name: 'data', type: 'bytea', nullable: true})
  public data!: Buffer;

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

  @Column({name: 'compressed', default: false})
  public compressed!: boolean;
}

@Entity({name: 'high_hand_history'})
export class HighHandHistory {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index()
  @Column({name: 'game_id', nullable: false, type: 'int'})
  public gameId!: number;

  @Column({name: 'player_id', nullable: false, type: 'int'})
  public playerId!: number;

  @Column({name: 'reward_id', nullable: true, type: 'int'})
  public rewardId!: number;

  @Column({name: 'reward_tracking_id', nullable: true, type: 'int'})
  public rewardTrackingId!: number;

  @Column({name: 'hand_num', nullable: false})
  public handNum!: number;

  @Column({name: 'player_cards', nullable: false})
  public playerCards!: string;

  @Column({name: 'board_cards', nullable: false})
  public boardCards!: string;

  @Column({name: 'high_hand', nullable: false})
  public highHand!: string;

  // cards displayed in characters
  @Column({name: 'high_hand_cards', nullable: true})
  public highHandCards!: string;

  @Column({name: 'rank', nullable: false})
  public rank!: number;

  @Column({name: 'winner', nullable: false})
  public winner!: boolean;

  @Column({name: 'hand_time', nullable: false})
  public handTime!: Date;

  @Column({name: 'start_hour', nullable: true})
  public startHour!: boolean;

  @Column({name: 'end_hour', nullable: true})
  public endHour!: boolean;
}
