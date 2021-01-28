import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {Club, ClubMember} from './club';
import {DbAwareUpdateDateColumn} from './dbaware';
import {ClubMessageType, HostMessageType} from './types';

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

@Entity({name: 'club_host_messages'})
export class ClubHostMessages {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'message_type', type: 'int'})
  public messageType!: HostMessageType;

  @Column({name: 'text'})
  public text!: string;

  @ManyToOne(() => Club, club => club.id)
  @JoinColumn({name: 'club'})
  public club!: Club;

  @ManyToOne(() => ClubMember, member => member.id)
  @JoinColumn({name: 'saved_by'})
  public member!: ClubMember;

  @Column({name: 'read_status', default: false})
  public readStatus!: boolean;

  @DbAwareUpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public messageTime!: Date;
}
