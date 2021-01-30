import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import {Club} from './club';
import {Player} from './player';
import {ChatTextType} from './types';

@Entity({name: 'chat_text'})
export class ChatText {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column('int')
  public type!: ChatTextType;

  @Column({name: 'text', nullable: true})
  public text!: string;

  @Index('chat-club-idx')
  @ManyToOne(() => Club, club => club.id)
  @JoinColumn({name: 'club'})
  public club!: Club;

  @Index('chat-player-idx')
  @ManyToOne(() => Player, {eager: false})
  @JoinColumn({name: 'player_id'})
  public player!: Player;
}
