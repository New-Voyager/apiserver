export enum GameType {
  UNKNOWN,
  HOLDEM,
  PLO,
  PLO_HILO,
  FIVE_CARD_PLO,
  FIVE_CARD_PLO_HILO,
  SIX_CARD_PLO,
  SIX_CARD_PLO_HILO,
  ROE,
  DEALER_CHOICE,
}

export enum ChipUnit {
  DOLLAR,
  CENT,
}

// Game status track the host actions on a game
// This information is updated by the host/manager
export enum GameStatus {
  UNKNOWN,
  CONFIGURED,
  ACTIVE,
  PAUSED,
  ENDED,
}

// Table status track the current status of the table
// This information is updated by the game server
export enum TableStatus {
  UNKNOWN,
  WAITING_TO_BE_STARTED,
  NOT_ENOUGH_PLAYERS,
  GAME_RUNNING,
  HOST_SEATCHANGE_IN_PROGRESS,
  HOST_SEATCHANGE_COMPLETE,
}

export enum NextHandUpdate {
  UNKNOWN,
  SWITCH_SEAT,
  TAKE_BREAK,
  RELOAD_CHIPS,
  BACK_FROM_BREAK,
  LEAVE,
  PAUSE_GAME,
  END_GAME,
  KICKOUT,
  JOIN_GAME,
  WAIT_BUYIN_APPROVAL,
  WAIT_RELOAD_APPROVAL,
  BUYIN_APPROVED,
  RELOAD_APPROVED,
  BUYIN_DENIED,
  RELOAD_DENIED,
  WAIT_FOR_DEALER_CHOICE,
}

export enum WonAtStatus {
  PREFLOP,
  FLOP,
  TURN,
  RIVER,
  SHOW_DOWN,
}

export enum GameServerStatus {
  UNKNOWNN,
  ACTIVE,
  DOWN,
}

export enum ClubMessageType {
  TEXT,
  HAND,
  GIPHY,
  JOIN_CLUB,
  LEAVE_CLUB,
  KICKED_OUT,
  NEW_GAME,
}

export enum ClubMemberStatus {
  UNKNOWN,
  INVITED,
  PENDING,
  DENIED,
  ACTIVE,
  LEFT,
  KICKEDOUT,
}

export enum PlayerStatus {
  PLAYER_UNKNOWN_STATUS,
  NOT_PLAYING,
  PLAYING,
  IN_QUEUE,
  IN_BREAK,
  STANDING_UP,
  LEFT,
  KICKED_OUT,
  BLOCKED,
  LOST_CONNECTION,
  WAIT_FOR_BUYIN,
  LEAVING_GAME,
  TAKING_BREAK,
  JOINING,
  WAITLIST_SEATING,
  PENDING_UPDATES,
  WAIT_FOR_BUYIN_APPROVAL,
}

export enum PromotionType {
  HIGH_HAND,
  BAD_BEAT,
  SPECIFIC_CARDS,
}

export enum BuyInApprovalStatus {
  WAITING_FOR_APPROVAL,
  APPROVED,
  DENIED,
}

export enum ClubStatus {
  UNKNOWN,
  ACTIVE,
  DEFUNCT,
}

export enum RewardType {
  HIGH_HAND,
  BAD_BEAT,
  HEAD_HUNTING,
}

export enum ScheduleType {
  ENTIRE_GAME,
  HOURLY,
  TWO_HOURS,
}

export enum ApprovalType {
  BUYIN_REQUEST,
  RELOAD_REQUEST,
}

export enum ApprovalStatus {
  APPROVED,
  DENIED,
}

export enum HostMessageType {
  FROM_HOST,
  TO_HOST,
}

export enum ChatTextType {
  SYSTEM,
  CLUB,
  PLAYER,
}

export enum SeatChangeProcessType {
  AUTO, // seat change process is initiated by the server
  HOST, // seat change process is initiated by the host
}

export enum AnnouncementType {
  SYSTEM,
  CLUB,
}

export enum AnnouncementLevel {
  INFO,
  IMPORTANT,
}

export enum TransactionType {
  TIPS,
  GAME_BUYIN,
  GAME_RETURN,
  GAME_FEE,
  GAME_REWARD,
  SEND_PLAYER_TO_PLAYER,
  RECEIVE_PLAYER_TO_PLAYER,
  SEND_PLAYER_TO_CLUB,
  RECEIVE_PLAYER_TO_CLUB,
  SEND_CLUB_TO_PLAYER,
  RECEIVE_CLUB_TO_PLAYER,
  ADD_TOKENS_TO_PLAYER,
  WITHDRAW_TOKENS_FROM_PLAYER,
  ADD_TOKENS_TO_CLUB,
  WITHDRAW_TOKENS_FROM_CLUB,
  CLUB_BALANCE_UPDATED,
  PLAYER_BALANCE_UPDATED,
}

export enum TransactionSubType {
  REWARD,
  BONUS,
  MANAGER_INCENTIVE,
  HOST_INCENTIVE,
  MISC_EXP,
  MISC_INCOME,
  ADJUSTMENT,
  TRANSACTION,
}

export enum SeatStatus {
  UNKNOWN,
  OPEN,
  OCCUPIED,
  RESERVED,
}

export interface PlayerLocation {
  lat: number;
  long: number;
}

export enum HandDataType {
  JSON,
  COMPRESSED_JSON,
  COMPRESSED_JSON_BASE64,
  PROTO_HAND_V1,
}

export enum GameEndReason {
  UNKNOWN,
  HOST_TERMINATED,
  NOT_ENOUGH_COINS,
  SYSTEM_TERMINATED,
}

export enum CreditUpdateType {
  CHANGE,
  BUYIN,
  GAME_RESULT,
  ADD,
  DEDUCT,
  FEE_CREDIT,
}

export enum BuyInApprovalLimit {
  BUYIN_NO_LIMIT,
  BUYIN_CREDIT_LIMIT,
  BUYIN_HOST_APPROVAL,
}

export enum BombPotInterval {
  EVERY_X_HANDS,
  TIME_INTERVAL,
}
