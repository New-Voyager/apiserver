import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {PokerGame} from './game';
import {DbAwareColumn, DbAwareUpdateDateColumn} from '../dbaware';
import {BuyInApprovalStatus, PlayerStatus} from '../types';

@Entity({name: 'player_game_tracker'})
export class PlayerGameTracker {
  // NOTE:
  // SOMA: I added pgt_ prefix to avoid an ambigous column reference caused by the SQL generated by typeorm
  // "PlayerGameTracker"."player_id" AS "PlayerGameTracker_player_id",
  // "PlayerGameTracker_player"."id" AS "PlayerGameTracker_player_id"

  @PrimaryGeneratedColumn()
  public id!: number;

  @Index('player-game-tracker-game-idx')
  @ManyToOne(() => PokerGame, game => game.id)
  @JoinColumn({name: 'pgt_game_id'})
  public game!: PokerGame;

  @Index('player-game-tracker-player-idx')
  @Column({name: 'pgt_player_id', type: 'int'})
  public playerId!: number;

  @Column({name: 'player_name'})
  public playerName!: string;

  @Column({name: 'player_uuid'})
  public playerUuid!: string;

  @Column({name: 'buy_in', type: 'decimal'})
  public buyIn!: number;

  @Column({name: 'stack', type: 'decimal'})
  public stack!: number;

  @Column({name: 'status', nullable: false, type: 'int'})
  public status!: PlayerStatus;

  @Column({name: 'buyIn_status', nullable: true, type: 'int'})
  public buyInStatus!: BuyInApprovalStatus;

  @Column({name: 'buyin_notes', type: 'text', nullable: true})
  public buyinNotes!: string;

  @Column({name: 'game_token', type: 'text', nullable: false, default: ''})
  public gameToken!: string;

  @Column({name: 'audio_token', type: 'text', nullable: false, default: ''})
  public audioToken!: string;

  @Column({name: 'seat_no', nullable: true})
  public seatNo!: number;

  @Column({name: 'no_of_buyins', default: 0})
  public noOfBuyins!: number;

  @Column({name: 'hh_rank', nullable: true})
  public hhRank!: number;

  @Column({name: 'hh_hand_num', nullable: true})
  public hhHandNum!: number;

  @Column({name: 'session_time', default: 0})
  public sessionTime!: number;

  @DbAwareColumn({
    name: 'session_start_time',
    type: 'timestamp',
    nullable: true,
  })
  public sessionStartTime!: Date;

  @Column({name: 'no_hands_played', default: 0})
  public noHandsPlayed!: number;

  @Column({name: 'no_hands_won', default: 0})
  public noHandsWon!: number;

  @Column({name: 'rake_paid', type: 'decimal', default: 0})
  public rakePaid!: number;

  @Column({name: 'big_win', type: 'decimal', default: 0})
  public bigWin!: number;

  @Column({name: 'big_win_hand', type: 'int', default: 0})
  public bigWinHand!: number;

  @Column({name: 'big_loss', type: 'decimal', default: 0})
  public bigLoss!: number;

  @Column({name: 'big_loss_hand', type: 'int', default: 0})
  public bigLossHand!: number;

  @DbAwareColumn({name: 'hand_stack', type: 'text', nullable: true})
  public handStack!: string;

  @DbAwareColumn({
    name: 'seat_change_requested_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  public seatChangeRequestedAt!: Date | null;

  @DbAwareColumn({
    name: 'sat_at',
    type: 'timestamp',
    nullable: true,
  })
  public satAt!: Date;

  @DbAwareColumn({
    name: 'left_at',
    type: 'timestamp',
    nullable: true,
  })
  public leftAt!: Date;

  @DbAwareColumn({
    name: 'break_time_exp_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  public breakTimeExpAt!: Date;

  @DbAwareColumn({
    name: 'break_time_started_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  public breakTimeStartedAt!: Date;

  @DbAwareColumn({
    name: 'buyin_exp_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  public buyInExpAt!: Date;

  @DbAwareColumn({
    name: 'waiting_from',
    type: 'timestamp',
    nullable: true,
  })
  public waitingFrom!: Date | null;

  @Column({name: 'waitlist_num', type: 'int', default: 0})
  public waitlistNum!: number;

  @Column({name: 'run_it_twice_prompt', default: false})
  public runItTwicePrompt!: boolean;

  @Column({name: 'muck_losing_hand', default: false})
  public muckLosingHand!: boolean;

  // this user is notified to take a seat and the time will expire at this time
  @DbAwareColumn({
    name: 'waitlist_sitting_exp',
    type: 'timestamp',
    nullable: true,
  })
  public waitingListTimeExp!: Date | null;

  @Column({name: 'consecutive_action_timeouts', type: 'int', default: 0})
  public consecutiveActionTimeouts!: number;
}