import {PlayerStatus} from './entity/types';

export interface PageOptions {
  prev?: number;
  next?: number;
  count?: number;
}

export interface SeatMove {
  openSeat: boolean;
  playerId: number;
  playerUuid: string;
  name: string;
  stack: number;
  oldSeatNo: number;
  newSeatNo: number;
}

export interface SeatUpdate {
  seatNo: number;
  openSeat: boolean;
  playerId?: number;
  playerUuid?: string;
  name?: string;
  stack?: number;
  status?: PlayerStatus;
}
