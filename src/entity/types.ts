export enum GameType {
  UNKNOWN,
  HOLDEM,
  PLO,
  PLO_HILO,
  FIVE_CARD_PLO,
  FIVE_CARD_PLO_HILO,
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

export enum AnnouncementType {
  SYSTEM,
  CLUB,
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
  SUBTRACT_TOKENS_FROM_PLAYER,
  ADD_TOKENS_TO_CLUB,
  WITHDRAW_TOKENS_FROM_CLUB,
  CLUB_BALANCE_UPDATED,
  PLAYER_BALANCE_UPDATED,
}

export enum SubTransactionType {
  REWARD,
  BONUS,
  MANAGER_INCENTIVE,
  HOST_INCENTIVE,
  MISC_EXP,
  MISC_INCOME,
  ADJUSTMENT,
  TRANSACTION,
}
