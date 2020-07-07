import {Entity, PrimaryGeneratedColumn, Column, Index} from 'typeorm';
import {DbAwareCreateDateColumn, DbAwareUpdateDateColumn} from './dbaware';

@Entity()
export class Player {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({unique: true})
  public uuid!: string;

  @Column()
  public name!: string;

  @Index()
  @Column({name: 'device_id', unique: true})
  public deviceId!: string;

  @Column({name: 'is_active'})
  public isActive!: boolean;
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
