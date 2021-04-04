import {Entity, PrimaryGeneratedColumn, Column, Index} from 'typeorm';
import {DbAwareCreateDateColumn} from './dbaware';

@Entity({name: 'crash_test'})
export class CrashTest {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index()
  @Column({name: 'game_code'})
  public gameCode!: string;

  @Column({name: 'crash_point'})
  public crashPoint!: string;

  /**
   * DB insert time.
   */
  @DbAwareCreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt!: Date;
}
