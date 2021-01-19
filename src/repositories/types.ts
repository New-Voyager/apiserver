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

export interface HighHandWinnerResult {
  rewardTrackingId: number;
  winners: Array<HighHandWinner>;
}

export interface HighHandWinner {
  gameCode: string;
  playerName: string;
  playerUuid: string;
  playerId: number;
  playerCards: Array<number>;
  boardCards: Array<number>;
  hhCards: Array<number>;
}

export interface HighHandResult {
  gameCode: string;
  handNum: number;
  rewardTrackingId: number;
  associatedGames: Array<string>; // game codes
  winners: Array<HighHandWinner>;
}

export interface SaveHandResult {
  gameCode: string;
  handNum: number;
  success: boolean;
  error?: string;
  highHand?: HighHandResult;
}

export const WAITLIST_SEATING = 'WAITLIST_SEATING';
export const SEATCHANGE_PROGRSS = 'SEATCHANGE_INPROGRESS';
export const BUYIN_TIMEOUT = 'BUYIN_TIMEOUT';
export const BUYIN_APPROVAL_TIMEOUT = 'BUYIN_APPROVAL_TIMEOUT';
export const RELOAD_APPROVAL_TIMEOUT = 'RELOAD_APPROVAL_TIMEOUT';

// full house rank
export const MIN_FULLHOUSE_RANK = 322;
