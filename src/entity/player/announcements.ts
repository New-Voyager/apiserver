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
import {AnnouncementType} from '../types';

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
