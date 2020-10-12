import {Entity, Column, PrimaryGeneratedColumn} from 'typeorm';
import { DbAwareUpdateDateColumn } from './dbaware';

@Entity({name: 'club_freq_messages'})
export class FavouriteMessage {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'club_code', nullable: true})
  public clubCode!: string;

  @Column({name: 'player_id', nullable: true})
  public playerId!: string;

  @Column({name: 'text', nullable: true})
  public text!: string;

  @Column({name: 'audio_link', nullable: true})
  public audioLink!: string;

  @Column({name: 'image_link', nullable: true})
  public imageLink!: string;

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

