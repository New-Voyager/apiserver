import { TournamentStatus } from '@src/repositories/balance';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { DbAwareColumn, DbAwareCreateDateColumn, DbAwareUpdateDateColumn } from '../dbaware';

@Entity({ name: 'tournaments' })
export class Tournament {
  @PrimaryGeneratedColumn()
  public id!: number;

  // json field that stores tournament data
  @Column({ name: 'data', nullable: false, default: '{}' })
  public data!: string;

  @Column({ name: 'table_server', nullable: false, default: '' })
  public tableServer!: string;

  @Column({ name: 'max_players', default: 9 })
  public maxPlayersInTable!: number;

  @Column({ name: 'bots_count', default: 0 })
  public botsCount!: number;

  @Column({ name: 'status', nullable: true, default: TournamentStatus.UNKNOWN })
  public status!: TournamentStatus;

  @Column({ name: 'about_to_notification', default: 60 })   // send a notification before schedule time
  public aboutToNotificationTime!: number;

  @DbAwareColumn({
    name: 'scheduled_at',
    type: 'timestamp',
    nullable: true
  })
  public scheduledAt!: Date;

  /**
   * DB insert time.
   */
  @DbAwareCreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt!: Date;

  /**
   * DB last update time.
   */
  @DbAwareUpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;
}
