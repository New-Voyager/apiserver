import {Entity, Column, Index, PrimaryGeneratedColumn} from 'typeorm';

@Entity({name: 'host_seat_change_process'})
export class HostSeatChangeProcess {
  @PrimaryGeneratedColumn()
  public id!: number;

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
