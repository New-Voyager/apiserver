export enum GameType {
  UNKNOWN,
  HOLDEM,
  OMAHA,
  OMAHA_HILO,
  FIVECARD_OMAHA,
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
// This information is updated from the game server
export enum TableStatus {
  UNKNOWN,
  SETUP,
  PREPARING,
  NOT_ENOUGH_PLAYERS,
  TABLE_FULL,
  GAME_RUNNING,
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
