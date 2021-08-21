import {Column, Entity, PrimaryGeneratedColumn} from 'typeorm';
import {DbAwareUpdateDateColumn} from '../dbaware';

@Entity({name: 'bug_reports'})
export class BugReport {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'player_uuid'})
  public reportedPlayerUuid!: string;

  @Column({name: 'bug'})
  public bug!: string;

  @DbAwareUpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;
}
