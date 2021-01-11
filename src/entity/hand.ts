import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
} from 'typeorm';

import {DbAwareColumn} from './dbaware';
import {GameType, WonAtStatus} from './types';

@Entity({name: 'hand_winners'})
export class HandWinners {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index()
  @Column({name: 'game_id'})
  public gameId!: number;

  @Column({name: 'hand_num'})
  public handNum!: number;

  @Column({name: 'is_high', default: true})
  public isHigh!: boolean;

  @Column({name: 'winning_cards', nullable: true})
  public winningCards!: string;

  @Column({name: 'winning_rank', type: 'int', nullable: true})
  public winningRank!: number;

  @Index()
  @Column({name: 'player_id'})
  public playerId!: number;

  @Column({name: 'received', type: 'float'})
  public received!: number;
}

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

  @DbAwareColumn({name: 'players', type: 'int', array: true, nullable: true})
  public players!: Array<number>;

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

@Entity({name: 'starred_hands'})
export class StarredHands {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index()
  @Column({name: 'player_id'})
  public playerId!: number;

  @Index()
  @Column({name: 'game_id'})
  public gameId!: number;

  @Column({name: 'hand_num'})
  public handNum!: number;

  @ManyToOne(type => HandHistory)
  public handHistory!: HandHistory;
}
