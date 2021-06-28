import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {Club, ClubMember} from './club';
import {DbAwareCreateDateColumn, DbAwareUpdateDateColumn} from '../dbaware';
import {Player, SavedHands} from './player';
import {ClubMessageType, HostMessageType} from '../types';

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

  @ManyToOne(type => Player, {nullable: false, eager: true})
  @JoinColumn({name: 'player_id'})
  public player!: Player;

  @Column({name: 'hand_number', type: 'int', nullable: true})
  public handNum!: number;

  @Column({name: 'giphy_link', nullable: true})
  public giphyLink!: string;

  @Column({name: 'game_number', nullable: true})
  public gameNum!: number;

  // this is a foreign key
  @ManyToOne(type => SavedHands, {nullable: true, eager: true})
  @JoinColumn({name: 'share_hand_id'})
  public sharedHand!: SavedHands;

  @Column({name: 'player_tags', nullable: true})
  public playerTags!: string;

  /**
   * Message time
   */
  @DbAwareCreateDateColumn({
    type: 'timestamptz',
    name: 'message_time',
  })
  public messageTime!: Date;
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
  @JoinColumn({name: 'member'})
  public member!: ClubMember;

  @Column({name: 'read_status', default: false})
  public readStatus!: boolean;

  @DbAwareCreateDateColumn({
    type: 'timestamp',
    name: 'message_time',
  })
  public messageTime!: Date;
}
