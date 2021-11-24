import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {Club} from './club';
import {
  DbAwareColumn,
  DbAwareCreateDateColumn,
  DbAwareUpdateDateColumn,
} from '../dbaware';
import {AnnouncementLevel, AnnouncementType} from '../types';
import {Player} from './player';

@Entity({name: 'announcement'})
export class Announcement {
  @PrimaryGeneratedColumn()
  public id!: number;

  @ManyToOne(() => Club, club => club.id, {nullable: true})
  @JoinColumn({name: 'club'})
  public club!: Club;

  @Column({name: 'announcement_type', type: 'int'})
  public announcementType!: AnnouncementType;

  @Column({name: 'text'})
  public text!: string;

  @Column({name: 'level', default: AnnouncementLevel.INFO})
  public announcementLevel!: AnnouncementLevel;

  @ManyToOne(type => Player, {nullable: true, eager: true})
  @JoinColumn({name: 'player_id'})
  public user!: Player;

  @DbAwareColumn({
    name: 'expires_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  public expiresAt!: Date;

  @DbAwareCreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt!: Date;

  @DbAwareUpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;
}
