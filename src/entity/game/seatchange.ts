import {Entity, Column, Index, PrimaryGeneratedColumn} from 'typeorm';
import {DbAwareColumn} from '../dbaware';
import {SeatStatus} from '../types';

@Entity({name: 'host_seat_change_process'})
export class HostSeatChangeProcess {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index()
  @Column({name: 'game_code'})
  public gameCode!: string;

  @Column({name: 'seat_no'})
  public seatNo!: number;

  @Column({name: 'player_id', nullable: true})
  public playerId!: number;

  @Column({name: 'player_uuid', nullable: true})
  public playerUuid!: string;

  @Column({name: 'name', nullable: true})
  public name!: string;

  @Column({name: 'open_seat', default: false})
  public openSeat!: boolean;

  @Column({name: 'stack', default: 0})
  public stack!: number;
}

@Entity({name: 'player_seat_change_process'})
export class PlayerSeatChangeProcess {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Index()
  @Column({name: 'game_code'})
  public gameCode!: string;

  @Column({name: 'seat_no'})
  public seatNo!: number;

  @Column({name: 'player_id', nullable: true})
  public playerId!: number;

  @Column({name: 'player_uuid', nullable: true})
  public playerUuid!: string;

  @Column({name: 'name', nullable: true})
  public name!: string;

  @Column({name: 'prompted', default: false})
  public prompted!: boolean;

  @DbAwareColumn({
    name: 'seat_change_requested_at',
    type: 'timestamp',
    nullable: true,
    default: null,
  })
  public seatChangeRequestedAt!: Date | null;

  @Column({name: 'stack', default: 0})
  public stack!: number;
}
