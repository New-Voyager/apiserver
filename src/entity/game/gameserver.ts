import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';

import {DbAwareColumn} from '../dbaware';
import {PokerGame} from './game';
import {GameServerStatus} from '../types';

@Entity({name: 'game_server'})
export class GameServer {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index()
  @Column({name: 'ip_address'})
  public ipAddress!: string;

  @DbAwareColumn({
    name: 'started_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public startedAt!: Date;

  @DbAwareColumn({
    name: 'last_heartbeat_time',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  public lastHeartBeatTime!: Date;

  @Column()
  public status!: GameServerStatus;

  @Column({name: 'max_games', type: 'int', default: 500})
  public maxGames!: number;

  @Column({name: 'no_games_handled', type: 'int'})
  public noGamesHandled!: number;

  @Column({name: 'no_active_games', type: 'int'})
  public noActiveGames!: number;

  @Column({name: 'no_active_players', type: 'int'})
  public noActivePlayers!: number;

  @Column({name: 'no_players_handled', type: 'int'})
  public noPlayersHandled!: number;

  @Column({name: 'starting_memory', type: 'int'})
  public startingMemory!: number;

  @Column({name: 'current_memory', type: 'int'})
  public currentMemory!: number;

  @DbAwareColumn({type: 'int8', name: 'server_num', unique: true})
  public serverNumber!: number;

  @Index()
  @DbAwareColumn({name: 'url', unique: true})
  public url!: string;
}
