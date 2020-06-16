import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, Index, JoinColumn} from "typeorm";
import {Club} from './club';
import {Player} from './player';

export enum GameType {
  UNKNOWN,
  HOLDEM,
  OMAHA,
  OMAHA_HILO,
}

@Entity({name: "poker_game"})
export class PokerGame {
    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column({unique: true})
    gameId: string

    @Index("game-club-idx")
    @ManyToOne(type => Club)
    @JoinColumn({name: "club_id"})
    club: Club;

    @Column()
    privateGame: boolean

    @Column({name: "is_template"})
    isTemplate: boolean;

    @Column({name: "game_type"})
    gameType: GameType;

    @Column({name: "title"})
    title: string;
    
    @Column({name: "small_blind", type: "decimal", precision: 7, scale: 2, nullable: false})
    smallBlind: number;

    @Column({name: "big_blind", type: "decimal", precision: 7, scale: 2, nullable: false})
    bigBlind: number;

    @Column({name: "straddle_bet", type: "decimal", precision: 7, scale: 2, nullable: true})
    straddleBet: number;

    @Column({name: "utg_straddle", nullable: true})
    utgStraddle: boolean;

    @Column({name: "button_straddle", nullable: true})
    buttonStraddle: boolean;

    @Column({name: "max_players", type: "int"})
    maxPlayers: number;

    @Column({name: "is_active", nullable: true})
    isActive: boolean;

    @Column({name: "game_length", type: "int"})
    gameLength: number;

    @Column({name: "buy_in_approval", default: true})
    buyInApproval: boolean;

    @Column({name: "sit_in_approval", default: true})
    sitInApproval: boolean;

    @Column({name: "break_length", default: 15})
    breakLength: number;

    @Column({name: "auto_kick_after_break", default: true})
    autoKickAfterBreak: boolean;

    @Column({name: "waitlist_supported", default: true})
    waitlistSupported: boolean;

    @Column({name: "max_waitlist", type: "int", default: 20})
    maxWaitlist: number;

    @Column({name: "rake_percentage", type: "decimal", precision: 5, scale: 2, default: 0,})
    rakePercentage: number;

    @Column({name: "rake_cap", type: "decimal", precision: 7, scale: 2, default: 0,})
    rakeCap: number;

    @Column({name: "buy_in_min", type: "decimal", precision: 12, scale: 2, nullable: false})
    buyInMin: number;

    @Column({name: "buy_in_max",  type: "decimal", precision: 12, scale: 2, nullable: false})
    buyInMax: number;

    @Column({name: "action_time", type: "int", default: 20})
    actionTime: number;

    @Column({name: "muck_losing_hand", default: true})
    muckLosingHand: boolean;

    @Column({name: "wait_for_bigblind", default: true})
    waitForBigBlind: boolean;

    @Column({name: "started_at", type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)"})
    startedAt: Date;

    /**
     * DB insert time.
     */
    @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
    public createdAt: Date;

    /**
     * DB last update time.
     */
    @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
    public updatedAt: Date;  
}


@Entity({name: "poker_game_players"})
export class PokerGamePlayers {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(type => PokerGame)
    game: PokerGame;

    @ManyToOne(type => Player)
    player: Player;

    @Column({name: "total_buy_in", type: "decimal", precision: 2, scale: 2, nullable: false})
    totalBuyIn: number

    @Column({name: "balance", type: "decimal", precision: 2, scale: 2, nullable: false})
    balance: number

    @Column({name: "joined_at", type: "timestamp"})
    joinedAt: Date;

    @Column({name: "left_at", type: "timestamp"})
    leftAt: Date;

    /**
     * DB insert time.
     */
    @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)" })
    public createdAt: Date;

    /**
     * DB last update time.
     */
    @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
    public updatedAt: Date;  
}

@Entity({name: "poker_hand"})
export class PokerHand {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(type => PokerGame)
    game: PokerGame;

    @Column({name: "started_at", type: "timestamp"})
    startedAt: Date;

    @Column({name: "ended_at", type: "timestamp"})
    endedAt: Date;

    @Column({type: "int8"})
    handNum: number;

    @Column({type: "int8", name: "hi_winners", array: true})
    hiWinners: number[]

    @Column({type: "int8", name: "low_winners", array: true})
    lowWinners: number[]

    @Column({type: "json", name: "hand_log"})
    handLog: any
}


/*
{
    pre_flop: {
            sb: player_id, 
            bb: player_id, 
            utg_straddle: player_id
            button_straddle: player_id,
            betting: [
              {
                sequence_no: 1
                type: RAISE
                player: { "id": player_id, balance: "balance" }
              },
              {
                sequence_no: 2
                type: FOLD
                player: { "id": player_id, balance: "balance" }
              }
            ],
            pot: value
        },
        flop: {
          community_cards: [],
            betting: [
              {
                sequence_no: 1
                type: RAISE
                player: { "id": player_id, balance: "balance" }
              },
              {
                sequence_no: 2
                type: FOLD
                player: { "id": player_id, balance: "balance" }
              }
            ],
            pot: value
        },
*/