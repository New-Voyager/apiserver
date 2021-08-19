import {Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {DbAwareCreateDateColumn, DbAwareUpdateDateColumn} from '../dbaware';
import { Player } from './player';

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

  @DbAwareCreateDateColumn({
    type: 'timestamp',
  })
  public expiresAt!: Date;

  @Column({name: 'max_count', nullable: true})
  public maxCount!: number;

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
