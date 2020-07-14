import {Entity, PrimaryGeneratedColumn, Column, Index,ManyToOne,   OneToOne, JoinColumn} from 'typeorm';
import {Player} from './player';
import {Club} from './club';
import {PokerGame} from './game'

export enum PlayerStatus {

  PLAYING,
  IN_QUEUE,
  BREAK,
  STANDING_UP,
  LEFT,
  KICKED_OUT,
  BLOCKED,
  WAIT_FOR_SITTING_APPROVAL,
  LOST_CONNECTION,
  WAIT_FOR_BUYIN_APPROVAL
  }

@Entity()
export class PlayerChipsTrack {
  @PrimaryGeneratedColumn()
  public id!: number

  @OneToOne(type => Player)
  public playerId!: Player;

  @OneToOne(type => Club)
  public clubId!: Club;

  @OneToOne(type => PokerGame)
  public gameId!: PokerGame;

  @Column({name:'buy_in', type: 'decimal'})
  public buyIn

  @Column({name: 'stack', type: 'decimal'})
  public stack

  @Column({name: 'status', nullable: false, type: 'int'})
  public status!: PlayerStatus;

  @Column({name: 'seat_no', nullable: false})
  public seatNo!: number;

  @Column({name: 'no_of_buyings'})
  public noOfBuyins! : number;
  
}


@Entity()
export class ClubGameRake {
  @PrimaryGeneratedColumn()
  public id!: number;

  @OneToOne(type => Club)
  public clubId!: Club;

  @OneToOne(type => PokerGame)
  public gameId!: PokerGame;

  @Column({name:'rake', type: 'decimal', nullable: false})
  public rake

  @Column({type:'decimal', name:'promotion'})
  public promotion

  @Column({name: 'last_hand_num', nullable: false})
  public lastHandNum!: number;
  
}
