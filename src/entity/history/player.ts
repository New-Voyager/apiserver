import { Entity, Column, Index, PrimaryGeneratedColumn } from 'typeorm';
import { DbAwareColumn, DbAwareUpdateDateColumn } from '../dbaware';
import { PlayerStatus } from '../types';

@Entity({ name: 'players_in_game' })
export class PlayersInGame {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index('game-id')
  @Column({ name: 'game_id' })
  public gameId!: number;

  @Index('game-player-id')
  @Column({ name: 'player_id', type: 'int' })
  public playerId!: number;

  @Column({ name: 'player_name' })
  public playerName!: string;

  @Column({ name: 'player_uuid' })
  public playerUuid!: string;

  @Column({ name: 'stack', type: 'decimal' })
  public stack!: number;

  @Column({ name: 'buy_in', type: 'decimal' })
  public buyIn!: number;

  @Column({ name: 'no_of_buyins', default: 0 })
  public noOfBuyins!: number;

  @Column({ name: 'session_time', default: 0 })
  public sessionTime!: number;

  @Column({ name: 'no_hands_played', default: 0 })
  public noHandsPlayed!: number;

  @Column({ name: 'no_hands_won', default: 0 })
  public noHandsWon!: number;

  @Column({ name: 'rake_paid', type: 'decimal', default: 0 })
  public rakePaid!: number;

  @DbAwareColumn({ name: 'hand_stack', type: 'text', nullable: true })
  public handStack!: string;

  @Column({ name: 'status', nullable: false, type: 'int' })
  public status!: PlayerStatus;

  @Column({ name: 'session_no', default: 1 })
  public sessionNo!: number;

  @Column({ name: 'active', default: true })  // indicates whether this session is active or not
  public active!: boolean;

  @Column({ name: 'credits_settled', default: false })
  public creditsSettled!: boolean;

  @Column({ name: 'session_left_time', type: 'timestamp', nullable: true }) // when the player left this session
  public sessionLeftTime!: Date;

  @DbAwareColumn({
    name: 'session_start_time',
    type: 'timestamp',
    nullable: true,
  })
  public sessionStartTime!: Date;

  // json column stores hand stats of the player in the game
  @DbAwareColumn({ name: 'hand_stats', type: 'text', nullable: true })
  public handStats!: string;

  @DbAwareColumn({
    name: 'left_at',
    type: 'timestamp',
    nullable: true,
  })
  public leftAt!: Date;

  @Column({ name: 'disconnect_count', type: 'int', default: 0 })
  public disconnectCount!: number;

  @Column({ name: 'refresh_count', type: 'int', default: 0 })
  public refreshCount!: number;
}
