import {Entity, Column, ManyToOne, JoinColumn, OneToOne} from 'typeorm';
import {Player} from './player';
import {PokerGame} from './game';

@Entity({name: 'player_game_stats'})
export class PlayerGameStats {
  @ManyToOne(() => PokerGame, game => game.id, {primary: true})
  @JoinColumn({name: 'pgs_game_id'})
  public game!: PokerGame;

  @ManyToOne(() => Player, player => player.id, {primary: true, eager: true})
  @JoinColumn({name: 'pgs_player_id'})
  public player!: Player;

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
}

@Entity({name: 'player_hand_stats'})
export class PlayerHandStats {
  @OneToOne(() => Player, player => player.id, {primary: true, eager: false})
  @JoinColumn({name: 'player_id'})
  public player!: Player;

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
}
