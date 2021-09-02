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
import {RewardType, ScheduleType} from '../types';
import {Club} from './club';

@Entity({name: 'reward'})
export class Reward {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index()
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
