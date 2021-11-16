import {AnnouncementLevel, GameType, PlayerStatus} from './entity/types';

export interface PageOptions {
  prev?: number;
  next?: number;
  count?: number;
}

export interface ClubTransaction {
  playerId?: string;
  type: string;
  subType: string;
  amount: number;
  notes?: string;
  updatedDate: Date;
}

export interface PlayerTransaction {
  playerId: string;
  otherPlayerId?: string;
  type: string;
  subType: string;
  amount: number;
  notes?: string;
  updatedDate: Date;
}

export interface AnnouncementData {
  text: string;
  createdAt: Date;
  expiresAt?: Date;
  level: string;
}

export interface buyInRequest {
  expireSeconds: number;
  approved: boolean;
}

export interface pendingApprovalsForClubData {
  requestId: number;
  gameCode: string;
  playerUuid: string;
  name: string;
  amount: number;
  approvalType: string;
  availableCredit: number;
  clubCode: string;
  gameType: GameType;
  smallBlind: number;
  bigBlind: number;
}

export interface getMembersFilterData {
  all?: boolean;
  unsettled?: boolean;
  managers?: boolean;
  playerId?: string;
  inactive?: boolean;
  negative?: boolean;
  positive?: boolean;
  inactiveFrom?: Date;
}

export interface getPlayerClubsData {
  clubCode: string;
  memberCount: string;
  name: string;
  host: string;
  ownerId: number;
  memberStatus: number;
  status: number;
  availableCredit: number;
  picUrl: string;
}

export interface getClubGamesData {
  title?: string;
  gameType: number;
  pageId: number;
  gameCode: string;
  gameNum?: number;
  smallBlind?: number;
  bigBlind?: number;
  startedBy?: string;
  startedAt: number;
  endedBy?: string;
  endedAt?: number;
  status?: number;
  runTime?: number;
  runTimeStr?: string;
  sessionTime?: number;
  sessionTimeStr?: string;
  handsPlayed?: number;
  balance?: number;
  satAt: Date;
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

export interface UserRegistrationPayload {
  name: string;
  deviceId: string;
  email?: string;
  displayName?: string;
  bot?: boolean;
}

export interface LoginPayload {
  deviceId: string;
  deviceSecret: string;
}
