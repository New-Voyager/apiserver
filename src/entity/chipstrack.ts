import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  OneToOne,
  JoinColumn,
  PrimaryColumn,
} from 'typeorm';
import {Player} from './player';
import {Club} from './club';
import {PokerGame} from './game';

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
  WAIT_FOR_BUYIN_APPROVAL,
}

@Entity({name: 'player_game_tracker'})
export class PlayerGameTracker {
  @ManyToOne(() => Player, player => player.id, {primary: true})
  @JoinColumn({name: 'player_id'})
  public player!: Player;

  @ManyToOne(() => Club, club => club.id, {primary: true})
  @JoinColumn({name: 'club_id'})
  public club!: Club;

  @ManyToOne(() => PokerGame, game => game.id, {primary: true})
  @JoinColumn({name: 'game_id'})
  public game!: PokerGame;

  @Column({name: 'buy_in', type: 'decimal'})
  public buyIn!: number;

  @Column({name: 'stack', type: 'decimal'})
  public stack!: number;

  @Column({name: 'status', nullable: false, type: 'int'})
  public status!: PlayerStatus;

  @Column({name: 'seat_no', nullable: false})
  public seatNo!: number;

  @Column({name: 'no_of_buyins'})
  public noOfBuyins!: number;

  @Column({name: 'hh_rank'})
  public hhRank!: number;

  @Column({name: 'hh_hand_num'})
  public hhHandNum!: number;
}

@Entity({name: 'club_game_rake'})
export class ClubGameRake {
  @ManyToOne(() => Club, club => club.id, {primary: true})
  @JoinColumn({name: 'club_id'})
  public club!: Club;

  @ManyToOne(() => PokerGame, game => game.id, {primary: true})
  @JoinColumn({name: 'game_id'})
  public game!: PokerGame;

  @Column({name: 'rake', type: 'decimal', nullable: false})
  public rake!: number;

  @Column({type: 'decimal', name: 'promotion'})
  public promotion!: number;

  @Column({name: 'last_hand_num', nullable: false})
  public lastHandNum!: number;
}
