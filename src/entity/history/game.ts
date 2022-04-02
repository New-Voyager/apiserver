import {Entity, Column, Index} from 'typeorm';
import {DbAwareColumn} from '../dbaware';
import {ChipUnit, GameEndReason, GameStatus, GameType} from '../types';

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

  @Column({name: 'chip_unit', nullable: false, default: ChipUnit.DOLLAR})
  public chipUnit!: ChipUnit;

  @Column({
    name: 'small_blind',
    type: 'decimal',
    precision: 7,
    scale: 2,
    nullable: false,
  })
  public smallBlind!: number;

  @Column({
    name: 'big_blind',
    type: 'decimal',
    precision: 7,
    scale: 2,
    nullable: false,
  })
  public bigBlind!: number;

  @Column({
    name: 'rake_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  public rakePercentage!: number;

  @Column({
    name: 'rake_cap',
    type: 'decimal',
    precision: 7,
    scale: 2,
    default: 0,
  })
  public rakeCap!: number;

  @Column({name: 'game_status', nullable: true, default: GameStatus.UNKNOWN})
  public status!: GameStatus;

  @Column({name: 'hands_dealt', default: 0})
  public handsDealt!: number;

  @Column({name: 'max_players', type: 'int'})
  public maxPlayers!: number;

  @Column({name: 'hh_tracked', default: false})
  public highHandTracked!: boolean;

  // used for tracking game number for club games
  @Column({name: 'game_num', type: 'int', default: 0})
  public gameNum!: number;

  @Column({name: 'roe_games', nullable: true, default: ''})
  public roeGames!: string; // comma separated list of round of each games

  @Column({name: 'dealer_choice_games', nullable: true, default: ''})
  public dealerChoiceGames!: string; // comma separated list of round of each games

  @Column({name: 'audio_conf_enabled', nullable: false, default: false})
  public audioConfEnabled!: boolean;

  @Column({name: 'demo_game', nullable: false, default: false})
  public demoGame!: boolean;

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

  @Column({name: 'credits_aggregated', nullable: false, default: false})
  public creditsAggregated!: boolean;

  @Column({name: 'hands_data_compressed', default: false})
  public handsDataCompressed!: boolean;

  @Column({name: 'hands_aggregated', default: false})
  public handsAggregated!: boolean;

  @Column({name: 'hand_data_link', default: ''})
  public handDataLink!: string;

  @Column({name: 'show_result', default: true})
  public showResult!: boolean;
}
