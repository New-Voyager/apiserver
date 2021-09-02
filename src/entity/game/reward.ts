import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  JoinColumn,
  ManyToOne,
  Index,
} from 'typeorm';

@Entity({name: 'game_reward_tracking'})
export class GameRewardTracking {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'day', nullable: false})
  public day!: Date;

  @Column({name: 'hh_rank', nullable: true})
  public hhRank!: number;

  @Column({name: 'game_id', nullable: true})
  public gameId!: number;

  @Column({name: 'reward_id', type: 'int'})
  public rewardId!: number;

  @Column({name: 'player_id', type: 'int', nullable: true})
  public playerId!: number;

  @Column({name: 'player_cards', nullable: true})
  public playerCards!: string;

  @Column({name: 'high_hand_rank', nullable: true})
  public highHandRank!: number;

  @Column({name: 'board_cards', nullable: true})
  public boardCards!: string;

  @Column({name: 'high_hand', nullable: true})
  public highHand!: string;

  @Column({name: 'hand_num', nullable: true})
  public handNum!: number;

  @Column({name: 'hit_time', nullable: true})
  public hitTime!: Date;

  @Column({name: 'start_time', nullable: true})
  public startTime!: Date;

  @Column({name: 'end_time', nullable: true})
  public endTime!: Date;

  @Column({name: 'active', nullable: true, default: true})
  public active!: boolean;
}

@Entity({name: 'game_reward'})
export class GameReward {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index()
  @Column({name: 'game_id', nullable: false})
  public gameId!: number;

  @Index()
  @Column({name: 'game_code', nullable: false})
  public gameCode!: string;

  @Column({name: 'reward_id', type: 'int'})
  public rewardId!: number;

  @ManyToOne(
    () => GameRewardTracking,
    rewardTrackingId => rewardTrackingId.id,
    {eager: true, nullable: false}
  )
  @JoinColumn({name: 'reward_tracking_id'})
  public rewardTrackingId!: GameRewardTracking;
}

@Entity({name: 'high_hand'})
export class HighHand {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index()
  @Column({name: 'game_id', nullable: false, type: 'int'})
  public gameId!: number;

  @Column({name: 'player_id', type: 'int'})
  public playerId!: number;

  @Column({name: 'reward_id', type: 'int', nullable: true})
  public rewardId!: number;

  @ManyToOne(
    () => GameRewardTracking,
    rewardTrackingId => rewardTrackingId.id,
    {eager: false, nullable: true}
  )
  @JoinColumn({name: 'reward_tracking_id'})
  public rewardTracking!: GameRewardTracking;

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
