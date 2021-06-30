import {Entity, Column, Index} from 'typeorm';
import {DbAwareColumn} from '../dbaware';
import {GameType} from '../types';

@Entity({name: 'game_history'})
export class GameHistory {
  @Column({name: 'game_id', primary: true})
  public gameId!: number;

  @Index()
  @Column({name: 'game_code'})
  public gameCode!: string;

  @Column({name: 'club_id', nullable: true})
  public clubId!: number;

  @Column({name: 'host_id'})
  public hostId!: number;

  @Column({name: 'host_name'})
  public hostName!: string;

  @Column({name: 'host_uuid'})
  public hostUuid!: string;

  @Column({name: 'game_type'})
  public gameType!: GameType;

  @Column({name: 'roe_games', nullable: true, default: ''})
  public roeGames!: string; // comma separated list of round of each games

  @Column({name: 'dealer_choice_games', nullable: true, default: ''})
  public dealerChoiceGames!: string; // comma separated list of round of each games

  @DbAwareColumn({
    name: 'started_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public startedAt!: Date;

  @DbAwareColumn({
    name: 'ended_at',
    type: 'timestamp',
    nullable: true,
  })
  public endedAt!: Date;

  @Column({name: 'ended_by_player_id', nullable: true, type: 'int'})
  public endedBy!: number;

  @Column({name: 'ended_by_name', nullable: true})
  public endedByName!: string;
}
