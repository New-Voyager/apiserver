import {Entity, Column, Index, PrimaryGeneratedColumn} from 'typeorm';
import {DbAwareColumn, DbAwareUpdateDateColumn} from '../dbaware';

@Entity({name: 'players_in_game'})
export class PlayersInGame {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index('game-id')
  @Column({name: 'game_id'})
  public gameId!: number;

  @Column({name: 'player_id', type: 'int'})
  public playerId!: number;

  @Column({name: 'player_name'})
  public playerName!: string;

  @Column({name: 'player_uuid'})
  public playerUuid!: string;

  @Column({name: 'buy_in', type: 'decimal'})
  public buyIn!: number;

  @Column({name: 'no_of_buyins', default: 0})
  public noOfBuyins!: number;

  @Column({name: 'session_time', default: 0})
  public sessionTime!: number;

  @Column({name: 'no_hands_played', default: 0})
  public noHandsPlayed!: number;

  @Column({name: 'no_hands_won', default: 0})
  public noHandsWon!: number;

  @DbAwareColumn({name: 'hand_stack', type: 'text', nullable: true})
  public handStack!: string;

  @DbAwareColumn({
    name: 'left_at',
    type: 'timestamp',
    nullable: true,
  })
  public leftAt!: Date;
}
