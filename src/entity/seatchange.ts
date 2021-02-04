import {
  Entity,
  Column,
  Index,
} from 'typeorm';

@Entity({name: 'host_seat_change_process'})
export class HostSeatChangeProcess {
  @Column({primary: true, name: 'game_code'})
  public gameCode!: string;

  @Column({primary: true, name: 'seat_no'})
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
