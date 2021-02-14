import {Entity, Column, Index, PrimaryGeneratedColumn} from 'typeorm';

@Entity({name: 'host_seat_change_process'})
export class HostSeatChangeProcess {
  @PrimaryGeneratedColumn()
  public id!: number;

  @Column({name: 'game_code'})
  public gameCode!: string;

  @Column({name: 'seat_no'})
  public seatNo!: number;

  @Column({name: 'player_id'})
  public playerId!: number;

  @Column({name: 'player_uuid'})
  public playerUuid!: string;

  @Column({name: 'name'})
  public name!: string;

  @Column({name: 'open_seat'})
  public openSeat!: boolean;

  @Column({name: 'stack'})
  public stack!: number;
}
