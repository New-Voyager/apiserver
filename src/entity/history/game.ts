import {Entity, Column, Index} from 'typeorm';
import {DbAwareColumn} from '../dbaware';
import {GameEndReason, GameStatus, GameType} from '../types';

@Entity({name: 'game_history'})
export class GameHistory {
  @Column({name: 'game_id', primary: true})
  public gameId!: number;

  @Index()
  @Column({name: 'game_code'})
  public gameCode!: string;

  @Column({name: 'club_id', nullable: true})
  public clubId!: number;

  @Column({name: 'club_code', nullable: true})
  public clubCode!: string;

  @Column({name: 'title'})
  public title!: string;

  @Column({name: 'game_type'})
  public gameType!: GameType;

  @Column({name: 'small_blind'})
  public smallBlind!: number;

  @Column({name: 'game_status', nullable: true, default: GameStatus.UNKNOWN})
  public status!: GameStatus;

  @Column({name: 'big_blind'})
  public bigBlind!: number;

  @Column({name: 'hands_dealt', default: 0})
  public handsDealt!: number;

  @Column({name: 'max_players', type: 'int'})
  public maxPlayers!: number;

  @Column({name: 'hh_tracked', default: false})
  public highHandTracked!: boolean;

  // used for tracking game number for club games
  @Column({name: 'game_num', type: 'int', default: 0})
  public gameNum!: number;

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

  @Column({name: 'started_by_player_id', type: 'int'})
  public startedBy!: number;

  @Column({name: 'started_by_name'})
  public startedByName!: string;

  @Column({name: 'ended_by_player_id', nullable: true, type: 'int'})
  public endedBy!: number;

  @Column({name: 'ended_by_name', nullable: true})
  public endedByName!: string;

  @Column({name: 'end_reason', default: GameEndReason.UNKNOWN})
  public endReason!: GameEndReason;

  // this flag is used to determine whether the data was aggregated after the game ended
  @Column({name: 'data_aggregated', nullable: false, default: false})
  public dataAggregated!: boolean;

  @Column({name: 'hands_data_compressed', default: false})
  public handsDataCompressed!: boolean;

  @Column({name: 'hands_aggregated', default: false})
  public handsAggregated!: boolean;

  @Column({name: 'hand_data_link', default: ''})
  public handDataLink!: string;
}
