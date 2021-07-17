import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Index,
} from 'typeorm';
import {GameType} from '../types';

@Entity({name: 'player_game_stats'})
export class PlayerGameStats {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'game_id', type: 'int'})
  public gameId!: number;

  @Column({name: 'player_id', type: 'int'})
  public playerId!: number;

  @Column({name: 'in_preflop', default: 0})
  public inPreflop!: number;

  @Column({name: 'in_flop', default: 0})
  public inFlop!: number;

  @Column({name: 'in_turn', default: 0})
  public inTurn!: number;

  @Column({name: 'in_river', default: 0})
  public inRiver!: number;

  @Column({name: 'went_to_showdown', default: 0})
  public wentToShowDown!: number;

  @Column({name: 'won_at_showdown', default: 0})
  public wonAtShowDown!: number;

  @Column({name: 'headsup_hands', default: 0})
  public headsupHands!: number;

  @Column({name: 'won_headsup_hands', default: 0})
  public wonHeadsupHands!: number;

  @Column({name: 'headsup_hand_details', type: 'text', default: '[]'}) // json array of heads up hand numbers [{handNum: 11, otherPlayer: "id", won: true/false}]
  public headsupHandDetails!: string;

  // betting stats
  @Column({name: 'preflop_raise', default: 0})
  public preflopRaise!: number;

  @Column({name: 'postflop_raise', default: 0})
  public postflopRaise!: number;

  @Column({name: 'three_bet', default: 0})
  public threeBet!: number;

  @Column({name: 'cont_bet', default: 0})
  public contBet!: number;

  @Column({name: 'vpip_count', default: 0})
  public vpipCount!: number;

  @Column({name: 'allin_count', default: 0})
  public allInCount!: number;

  @Column({name: 'total_hands', default: 0})
  public totalHands!: number;
}

@Entity({name: 'player_hand_stats'})
export class PlayerHandStats {
  @Column({name: 'player_id', type: 'int', primary: true})
  public playerId!: number;

  @Column({name: 'in_preflop', default: 0})
  public inPreflop!: number;

  @Column({name: 'in_flop', default: 0})
  public inFlop!: number;

  @Column({name: 'in_turn', default: 0})
  public inTurn!: number;

  @Column({name: 'in_river', default: 0})
  public inRiver!: number;

  @Column({name: 'went_to_showdown', default: 0})
  public wentToShowDown!: number;

  @Column({name: 'won_at_showdown', default: 0})
  public wonAtShowDown!: number;

  @Column({name: 'headsup_hands', default: 0})
  public headsupHands!: number;

  @Column({name: 'won_headsup_hands', default: 0})
  public wonHeadsupHands!: number;

  @Column({name: 'headsup_hand_summary', type: 'text', default: '{}'}) // json dictionary headsup stats against other players [{"player-id": {"total": 100, "won": 25}}]
  public headsupHandSummary!: string;

  // betting stats
  @Column({name: 'preflop_raise', default: 0})
  public preflopRaise!: number;

  @Column({name: 'postflop_raise', default: 0})
  public postflopRaise!: number;

  @Column({name: 'three_bet', default: 0})
  public threeBet!: number;

  @Column({name: 'cont_bet', default: 0})
  public contBet!: number;

  @Column({name: 'vpip_count', default: 0})
  public vpipCount!: number;

  @Column({name: 'allin_count', default: 0})
  public allInCount!: number;

  @Column({name: 'total_hands', default: 0})
  public totalHands!: number;

  @Column({name: 'total_games', default: 0})
  public totalGames!: number;

  @Column({name: 'recent_performance', type: 'text', default: '[]'}) // json array of recent data
  public recentPerformance!: string;
}

@Entity({name: 'club_stats'})
export class ClubStats {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index('club-stats-idx')
  @Column({name: 'club_id', type: 'int'})
  public clubId!: number;

  @Column({name: 'game_type'})
  public gameType!: GameType;

  @Column({name: 'total_hands', default: 0})
  public totalHands!: number;

  @Column({name: 'total_games', default: 0})
  public totalGames!: number;

  @Column({name: 'straight5_flush', default: 0})
  public straight5Flush!: number;

  @Column({name: 'straight6_flush', default: 0})
  public straight6Flush!: number;

  @Column({name: 'straight7_flush', default: 0})
  public straight7Flush!: number;

  @Column({name: 'straight8_flush', default: 0})
  public straight8Flush!: number;

  @Column({name: 'straight9_flush', default: 0})
  public straight9Flush!: number;

  @Column({name: 'straightt_flush', default: 0})
  public straightTFlush!: number;

  @Column({name: 'straightj_flush', default: 0})
  public straightJFlush!: number;

  @Column({name: 'straightq_flush', default: 0})
  public straightQFlush!: number;

  @Column({name: 'straightk_flush', default: 0})
  public straightKFlush!: number;

  @Column({name: 'straighta_flush', default: 0})
  public straightAFlush!: number;

  @Column({name: 'four_aaaa', default: 0})
  public fourAAAA!: number;

  @Column({name: 'four_kkkk', default: 0})
  public fourKKKK!: number;

  @Column({name: 'four_qqqq', default: 0})
  public fourQQQQ!: number;

  @Column({name: 'four_jjjj', default: 0})
  public fourJJJJ!: number;

  @Column({name: 'four_tttt', default: 0})
  public fourTTTT!: number;

  @Column({name: 'four_9999', default: 0})
  public four9999!: number;

  @Column({name: 'four_8888', default: 0})
  public four8888!: number;

  @Column({name: 'four_7777', default: 0})
  public four7777!: number;

  @Column({name: 'four_6666', default: 0})
  public four6666!: number;

  @Column({name: 'four_5555', default: 0})
  public four5555!: number;

  @Column({name: 'four_4444', default: 0})
  public four4444!: number;

  @Column({name: 'four_3333', default: 0})
  public four3333!: number;

  @Column({name: 'four_2222', default: 0})
  public four2222!: number;
}

@Entity({name: 'system_stats'})
export class SystemStats {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'game_type'})
  public gameType!: GameType;

  @Column({name: 'total_hands', default: 0})
  public totalHands!: number;

  @Column({name: 'total_games', default: 0})
  public totalGames!: number;

  @Column({name: 'straight5_flush', default: 0})
  public straight5Flush!: number;

  @Column({name: 'straight6_flush', default: 0})
  public straight6Flush!: number;

  @Column({name: 'straight7_flush', default: 0})
  public straight7Flush!: number;

  @Column({name: 'straight8_flush', default: 0})
  public straight8Flush!: number;

  @Column({name: 'straight9_flush', default: 0})
  public straight9Flush!: number;

  @Column({name: 'straightt_flush', default: 0})
  public straightTFlush!: number;

  @Column({name: 'straightj_flush', default: 0})
  public straightJFlush!: number;

  @Column({name: 'straightq_flush', default: 0})
  public straightQFlush!: number;

  @Column({name: 'straightk_flush', default: 0})
  public straightKFlush!: number;

  @Column({name: 'straighta_flush', default: 0})
  public straightAFlush!: number;

  @Column({name: 'four_aaaa', default: 0})
  public fourAAAA!: number;

  @Column({name: 'four_kkkk', default: 0})
  public fourKKKK!: number;

  @Column({name: 'four_qqqq', default: 0})
  public fourQQQQ!: number;

  @Column({name: 'four_jjjj', default: 0})
  public fourJJJJ!: number;

  @Column({name: 'four_tttt', default: 0})
  public fourTTTT!: number;

  @Column({name: 'four_9999', default: 0})
  public four9999!: number;

  @Column({name: 'four_8888', default: 0})
  public four8888!: number;

  @Column({name: 'four_7777', default: 0})
  public four7777!: number;

  @Column({name: 'four_6666', default: 0})
  public four6666!: number;

  @Column({name: 'four_5555', default: 0})
  public four5555!: number;

  @Column({name: 'four_4444', default: 0})
  public four4444!: number;

  @Column({name: 'four_3333', default: 0})
  public four3333!: number;

  @Column({name: 'four_2222', default: 0})
  public four2222!: number;
}

@Entity({name: 'club_member_stat'})
export class ClubMemberStat {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'club_id', type: 'int'})
  public clubId!: number;

  @Column({name: 'player_id', type: 'int'})
  public playerId!: number;

  @Column({
    name: 'total_buyins',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  public totalBuyins!: number;

  @Column({
    name: 'total_winnings',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  public totalWinnings!: number;

  @Column({name: 'total_games', type: 'int', nullable: true, default: 0})
  public totalGames!: number;

  @Column({name: 'total_hands', type: 'int', nullable: true, default: 0})
  public totalHands!: number;

  @Column({name: 'won_hands', type: 'int', nullable: true, default: 0})
  public wonHands!: number;

  @Column({
    name: 'rake_paid',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  public rakePaid!: number;
}
