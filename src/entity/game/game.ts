import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import {
  DbAwareColumn,
  DbAwareCreateDateColumn,
  DbAwareUpdateDateColumn,
} from '../dbaware';
import {
  GameStatus,
  GameType,
  TableStatus,
  NextHandUpdate,
  SeatChangeProcessType,
} from '../types';

@Entity({name: 'poker_game_updates'})
export class PokerGameUpdates {
  @Column({primary: true, name: 'game_id'})
  public gameID!: number;

  @Column({name: 'players_in_seats', type: 'int', default: 0})
  public playersInSeats!: number;

  @Column({name: 'players_in_waitlist', type: 'int', default: 0})
  public playersInWaitList!: number;

  @Column({name: 'waitlist_seating_inprogress', default: false})
  public waitlistSeatingInprogress!: boolean;

  @Column({name: 'seat_change_inprogress', default: false})
  public seatChangeInProgress!: boolean;

  @Column({
    name: 'seat_change_open_seat',
    default: 0,
    nullable: true,
    type: 'int',
  })
  public seatChangeOpenSeat!: number;

  @Column({name: 'seat_change', default: null, nullable: true})
  public seatChange!: SeatChangeProcessType;

  @Column({name: 'rake', type: 'decimal', precision: 8, scale: 2, default: 0.0})
  public rake!: number;

  // json field that stores the players who played in the last hand
  // this is used for calculating button position (dead button), small blind (dead small) and big blind
  @Column({name: 'players_in_last_hand', nullable: true, default: '[]'})
  public playersInLastHand!: string;

  @Column({name: 'hand_num', nullable: false, default: 0})
  public handNum!: number;

  @Column({name: 'button_pos', nullable: true, default: 0})
  public buttonPos!: number;

  @Column({name: 'sb_pos', nullable: true, default: 0})
  public sbPos!: number;

  @Column({name: 'bb_pos', nullable: true, default: 0})
  public bbPos!: number;

  @Column({name: 'calculate_button_pos', default: true}) // if bot runner script sets the button position, then don't re-calculate button pos
  public calculateButtonPos!: boolean;

  @Column({name: 'dealer_choice_seat', nullable: true, default: 0})
  public dealerChoiceSeat!: number;

  @Column({name: 'prev_game_type', default: GameType.UNKNOWN})
  public prevGameType!: GameType;

  @Column({name: 'game_type', default: GameType.UNKNOWN})
  public gameType!: GameType;

  @Column({name: 'janus_session_id', nullable: true, default: ''})
  public janusSessionId!: string;

  @Column({name: 'janus_plugin_handle', nullable: true, default: ''})
  public janusPluginHandle!: string;

  // janus room id
  @Column({name: 'janus_room_id', default: 0})
  public janusRoomId!: number;

  // janus room pin
  @Column({name: 'janus_room_pin', default: ''})
  public janusRoomPin!: string;

  @Column({name: 'coins_used', default: 0, type: 'int'})
  public coinsUsed!: number;

  @DbAwareColumn({
    name: 'next_coin_consume_time',
    type: 'timestamp',
    nullable: true,
  })
  public nextCoinConsumeTime!: Date;

  @Column({name: 'appcoin_host_notified', default: false})
  public appCoinHostNotified!: boolean;

  @Column({name: 'appcoin_per_block', default: 0, type: 'int'}) // per consumption block
  public appcoinPerBlock!: number;

  @Column({name: 'appcoin_consume_block', default: 0, type: 'int'}) // game time (in seconds) to allow game runtime
  public appcoinConsumeBlock!: number;
}

@Entity({name: 'poker_game'})
export class PokerGame {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index()
  @Column({unique: true, name: 'game_code'})
  public gameCode!: string;

  @Index('game-club-idx')
  @Column({name: 'club_id', nullable: true})
  public clubId!: number;

  @Column({name: 'club_name', nullable: true})
  public clubName!: string;

  @Column({name: 'club_code', nullable: true})
  public clubCode!: string;

  @Index('game-host-idx')
  @Column({name: 'host_id'})
  public hostId!: number;

  @Column({name: 'host_name'})
  public hostName!: string;

  @Column({name: 'host_uuid'})
  public hostUuid!: string;

  @Column({name: 'private_game'})
  public privateGame!: boolean;

  @Column({name: 'is_template'})
  public isTemplate!: boolean;

  @Column({name: 'game_type'})
  public gameType!: GameType;

  @Column({name: 'title'})
  public title!: string;

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
    name: 'straddle_bet',
    type: 'decimal',
  })
  public straddleBet!: number;

  @Column({name: 'utg_straddle', nullable: true})
  public utgStraddleAllowed!: boolean;

  @Column({name: 'button_straddle', nullable: true})
  public buttonStraddleAllowed!: boolean;

  @Column({name: 'max_players', type: 'int'})
  public maxPlayers!: number;

  @Column({name: 'is_active', nullable: true})
  public isActive!: boolean;

  @Column({name: 'game_status', nullable: true, default: GameStatus.UNKNOWN})
  public status!: GameStatus;

  @Column({name: 'table_status', nullable: true, default: TableStatus.UNKNOWN})
  public tableStatus!: TableStatus;

  @Column({name: 'game_length', type: 'int'})
  public gameLength!: number;

  @Column({name: 'buy_in_approval', default: false})
  public buyInApproval!: boolean;

  @Column({name: 'sit_in_approval', default: false})
  public sitInApproval!: boolean;

  @Column({name: 'break_length', default: 1})
  public breakLength!: number;

  @Column({name: 'seat_change_allowed', default: true})
  public seatChangeAllowed!: boolean;

  @Column({name: 'waitlist_allowed', default: true})
  public waitlistAllowed!: boolean;

  @Column({name: 'auto_kick_after_break', default: true})
  public autoKickAfterBreak!: boolean;

  @Column({name: 'waitlist_supported', default: true})
  public waitlistSupported!: boolean;

  @Column({name: 'max_waitlist', type: 'int', default: 20})
  public maxWaitlist!: number;

  @Column({name: 'seatchange_timeout', type: 'int', default: 30})
  public seatChangeTimeout!: number;

  @Column({name: 'buyin_timeout', type: 'int', default: 60})
  public buyInTimeout!: number;

  @Column({name: 'waitlist_sitting_timeout', type: 'int', default: 180})
  public waitlistSittingTimeout!: number;

  @Column({name: 'run_it_twice_allowed', default: false})
  public runItTwiceAllowed!: boolean;

  @Column({name: 'allow_rabbit_hunt', default: true})
  public allowRabbitHunt!: boolean;

  @Column({name: 'show_hand_rank', default: false})
  public showHandRank!: boolean;

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

  @Column({
    name: 'buy_in_min',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: false,
  })
  public buyInMin!: number;

  @Column({
    name: 'buy_in_max',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: false,
  })
  public buyInMax!: number;

  @Column({name: 'action_time', type: 'int', default: 20})
  public actionTime!: number;

  @Column({name: 'muck_losing_hand', default: true})
  public muckLosingHand!: boolean;

  @Column({name: 'wait_for_bigblind', default: true})
  public waitForBigBlind!: boolean;

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

  /**
   * DB insert time.
   */
  @DbAwareCreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public createdAt!: Date;

  /**
   * DB last update time.
   */
  @DbAwareUpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  public updatedAt!: Date;

  @Column({name: 'bot_game', default: false})
  public botGame!: boolean;

  // used for tracking game number for club games
  @Column({name: 'game_num', type: 'int', default: 0})
  public gameNum!: number;

  // used for tracking game number for club games
  @Column({name: 'hh_tracked', default: false})
  public highHandTracked!: boolean;

  // used for tracking game number for club games
  @Column({name: 'audio_conf_enabled', default: false})
  public audioConfEnabled!: boolean;

  // flag to indicate whether agroa conference should be used or not
  @Column({name: 'use_agora', default: false})
  public useAgora!: boolean;

  // This is not a database column and used for tracking highhand in the cache
  public highHandRank = 0;

  public pendingUpdates = false;

  public nextCoinConsumeTime: Date | null = null;
}

@Entity({name: 'next_hand_updates'})
export class NextHandUpdates {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'player_id', type: 'int', nullable: true})
  public playerId!: number;

  @Column({name: 'player_uuid', nullable: true})
  public playerUuid!: string;

  @Column({name: 'player_name', nullable: true})
  public playerName!: string;

  @ManyToOne(() => PokerGame, game => game.id, {eager: true})
  @JoinColumn({name: 'game_id'})
  public game!: PokerGame;

  @Column({name: 'new_update', type: 'int', nullable: true})
  public newUpdate!: NextHandUpdate;

  @Column({name: 'buyin_amount', type: 'decimal', nullable: true})
  public buyinAmount!: number;

  @Column({name: 'reload_amount', type: 'decimal', nullable: true})
  public reloadAmount!: number;

  @Column({name: 'reload_approved', default: false})
  public reloadApproved!: boolean;

  @Column({name: 'new_seat', nullable: true})
  public newSeat!: number;
}
