import {
  GameStatus,
  GameType,
  PlayerStatus,
  TableStatus,
} from '@src/entity/types';

export interface PlayerSitInput {
  clubId: number;
  gameId: number;
  playerId: number;
  buyIn: number;
  seatNo: number;
}

export enum NewUpdate {
  UNKNOWN_PLAYER_UPDATE,
  NEW_PLAYER,
  RELOAD_CHIPS,
  SWITCH_SEAT,
  TAKE_BREAK,
  SIT_BACK,
  LEFT_THE_GAME,
  EMPTY_STACK,
  NEW_BUYIN,
  BUYIN_TIMEDOUT,
  WAIT_FOR_BUYIN_APPROVAL,
  BUYIN_DENIED,
  NEWUPDATE_NOT_PLAYING,
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

export interface PlayerInSeat {
  seatNo: number;
  openSeat: boolean;
  playerId?: number;
  playerUuid?: string;
  name?: string;
  buyIn?: number;
  stack?: number;
  status?: number; // PlayerStatus
  buyInTimeExpAt?: string; // date time when buyin time expires
  breakTimeExpAt?: string; // date time when break time expires
  gameToken: string;
  runItTwicePrompt: boolean;
  muckLosingHand: boolean;
}

export interface NewHandInfo {
  gameCode: string;
  gameType: GameType;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  buttonPos: number;
  handNum: number;
  announceGameType: boolean;
  playersInSeats: Array<PlayerInSeat>;
  gameStatus: GameStatus;
  tableStatus: TableStatus;
  sbPos?: number;
  bbPos?: number;
}

export const WAITLIST_SEATING = 'WAITLIST_SEATING';
export const SEATCHANGE_PROGRSS = 'SEATCHANGE_INPROGRESS';
export const PLAYER_SEATCHANGE_PROMPT = 'PLAYER_SEATCHANGE_PROMPT';
export const BUYIN_TIMEOUT = 'BUYIN_TIMEOUT';
export const BUYIN_APPROVAL_TIMEOUT = 'BUYIN_APPROVAL_TIMEOUT';
export const RELOAD_APPROVAL_TIMEOUT = 'RELOAD_APPROVAL_TIMEOUT';
export const DEALER_CHOICE_TIMEOUT = 'DEALER_CHOICE_TIMEOUT';
export const BREAK_TIMEOUT = 'BREAK_TIMEOUT';
export const RELOAD_TIMEOUT = 'RELOAD_TIMEOUT';

// full house rank
export const MIN_FULLHOUSE_RANK = 322;

// CLUB_CHAT, PENDING_APPROVAL, NEW_MEMBER, MEMBER_APPROVED, MEMBER_DENIED,
//       HOST_MESSAGE, ANNOUNCEMENT

export enum ClubUpdateType {
  CLUB_CHAT,
  PENDING_APPROVAL,
  NEW_MEMBER,
  MEMBER_APPROVED,
  MEMBER_DENIED,
  HOST_MESSAGE,
  ANNOUNCEMENT,
  MEW_GAME,
}
