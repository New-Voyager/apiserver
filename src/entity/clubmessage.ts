import {Entity, Column, PrimaryGeneratedColumn} from 'typeorm';
import {DbAwareUpdateDateColumn} from './dbaware';
import {ClubMessageType} from './types';

@Entity({name: 'club_messages'})
export class ClubMessageInput {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column('int')
  public messageType!: ClubMessageType;

  @Column({name: 'text', nullable: true})
  public text!: string;

  @Column({name: 'club_code', nullable: false})
  public clubCode!: string;

  @Column({name: 'hand_number', type: 'int', nullable: true})
  public handNum!: number;

  @Column({name: 'giphy_link', nullable: true})
  public giphyLink!: string;

  @Column({name: 'game_number', nullable: true})
  public gameNum!: number;

  @Column({name: 'player_tags', nullable: true})
  public playerTags!: string;

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
