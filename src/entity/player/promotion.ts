import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  DbAwareColumn,
  DbAwareCreateDateColumn,
  DbAwareUpdateDateColumn,
} from '../dbaware';
import {Player} from './player';

@Entity()
export class Promotion {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column()
  public name!: string;

  @Column({unique: true, nullable: false})
  public code!: string;

  @Column()
  public coins!: number;

  @DbAwareColumn({
    name: 'expires_at',
    type: 'timestamp',
    nullable: true,
  })
  public expiresAt!: Date;

  @Column({name: 'max_count', nullable: true})
  public maxCount!: number;

  @Column({name: 'used_count', nullable: false, default: 0})
  public usedCount!: number;

  @ManyToOne(() => Player, player => player.id, {
    nullable: true,
    eager: true,
  })
  @JoinColumn({name: 'player'})
  public player!: Player;

  /**
   * DB insert time.
   */
  @DbAwareCreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt!: Date;

  /**
   * DB last update time.
   */
  @DbAwareUpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;
}
