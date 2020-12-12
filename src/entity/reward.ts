import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  JoinColumn,
  ManyToOne,
  Index,
} from 'typeorm';

import {Player} from './player';
import {RewardType, ScheduleType} from './types';
import {Club} from './club';
import {PokerGame} from './game';

@Entity({name: 'reward'})
export class Reward {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(() => Club, clubId => clubId.id, {eager: true, nullable: false})
  @JoinColumn({name: 'club_id'})
  public clubId!: Club;

  @Column({name: 'name', nullable: false})
  public name!: string;

  @Column({name: 'type', nullable: false})
  public type!: RewardType;

  @Column({name: 'amount', nullable: false})
  public amount!: number;

  @Column({name: 'schedule', nullable: false})
  public schedule!: ScheduleType;

  @Column({name: 'min_rank', nullable: true})
  public minRank!: number;

  @Column({name: 'start_hour', nullable: true})
  public startHour!: number;

  @Column({name: 'end_hour', nullable: true})
  public endHour!: number;
}

@Entity({name: 'game_reward_tracking'})
export class GameRewardTracking {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(() => Club, clubId => clubId.id, {eager: true, nullable: true})
  @JoinColumn({name: 'club_id'})
  public clubId!: Club;

  @Column({name: 'day', nullable: false})
  public day!: Date;

  @Column({name: 'hh_rank', nullable: true})
  public hhRank!: number;

  @ManyToOne(() => PokerGame, gameId => gameId.id, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({name: 'game_id'})
  public gameId!: PokerGame;

  @ManyToOne(() => Reward, rewardId => rewardId.id, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({name: 'reward_id'})
  public rewardId!: Reward;

  @ManyToOne(() => Player, playerId => playerId.id, {
    eager: true,
    nullable: true,
  })
  @JoinColumn({name: 'player_id'})
  public playerId!: Player;

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

  @ManyToOne(() => PokerGame, gameId => gameId.id, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({name: 'game_id'})
  public gameId!: PokerGame;

  @ManyToOne(() => Reward, rewardId => rewardId.id, {
    eager: true,
    nullable: false,
  })
  @JoinColumn({name: 'reward_id'})
  public rewardId!: Reward;

  @ManyToOne(
    () => GameRewardTracking,
    rewardTrackingId => rewardTrackingId.id,
    {eager: true, nullable: false}
  )
  @JoinColumn({name: 'reward_tracking_id'})
  public rewardTrackingId!: GameRewardTracking;
}
