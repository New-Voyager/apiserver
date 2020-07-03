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
} from './dbaware';


@Entity({name: 'hand_winners'})
export class HandWinners {
    @PrimaryGeneratedColumn()
    public id!: number;
  
    @Column({name: 'club_id', type: 'int'})
    public clubId!: number;
  
    @Column({name: 'game_num', type: 'int'})
    public gameNum!: number;
  
    @Column({name: 'hand_num', type: 'int'})
    public handNum!: number;
  
    @Column({name: 'is_high', default: true})
    public isHigh!: boolean;
  
    @Column({name: 'winning_cards', nullable: true})
    public winningCards!: string;
  
    @Column({name: 'winning_rank', type: 'int', nullable: true})
    public winningRank!: number;
  
    @Index()
    @Column({name: 'player_id', type: 'int'})
    public playerId!: number;
  
    @Column({name: 'received', type: 'float'})
    public received!: number;
}
  
export enum WonAtStatus {
    PREFLOP,
    FLOP,
    TURN,
    RIVER,
    SHOWDOWN,
}
  
export enum GameType {
    UNKNOWN,
    HOLDEM,
    OMAHA,
    OMAHA_HILO,
}
  
@Entity({name: 'hand_history'})
export class HandHistory {
    @PrimaryGeneratedColumn()
    public id!: number;
  
    @Column({name: 'club_id', type: 'int'})
    public clubId!: number;
  
    @Column({name: 'game_num', type: 'int'})
    public gameNum!: number;
  
    @Column({name: 'hand_num', type: 'int'})
    public handNum!: number;
  
    @Column({name: 'game_type'})
    public gameType!: GameType;
  
    @Column({name: 'won_at', type: 'int'})
    public wonAt!: WonAtStatus;
  
    @Column({name: 'show_down'})
    public showDown!: boolean;
  
    @Column({name: 'winning_cards', nullable: true})
    public winningCards!: string;
  
    @Column({name: 'winning_rank', type: 'int', nullable: true})
    public winningRank!: number;
    
    @Column({name: 'lo_winning_cards', nullable: true})
    public loWinningCards!: string;
  
    @Column({name: 'lo_winning_rank', type: 'int', nullable: true})
    public loWinningRank!: number;
  
    @Index()
    @DbAwareColumn({name: 'time_started', type: 'timestamp'})
    public timeStarted!: Date;
  
    @Index()
    @DbAwareColumn({name: 'time_ended', type: 'timestamp'})
    public timeEnded!: Date;
  
    @DbAwareColumn({name: 'data', type: 'text'})
    public data!: string;
  
    @Column({name: 'total_pot', type: 'float', default: 0})
    public totalPot!: number;
}