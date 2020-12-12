export interface PlayerSitInput {
  clubId: number;
  gameId: number;
  playerId: number;
  buyIn: number;
  seatNo: number;
}

export enum NewUpdate {
  NEW_PLAYER,
  RELOAD_CHIPS,
  SWITCH_SEAT,
  TAKE_BREAK,
  SIT_BACK,
  LEFT_THE_GAME,
  EMPTY_STACK,
  NEW_BUYIN,
}

export const WAITLIST_SEATING = 'WAITLIST_SEATING';
export const SEATCHANGE_PROGRSS = 'SEATCHANGE_INPROGRESS';
export const BUYIN_TIMEOUT = 'BUYIN_TIMEOUT';
