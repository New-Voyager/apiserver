// Application specific errors go here

import {ApolloError} from 'apollo-server-errors';

export enum Errors {
  WAITLIST_SEAT_ERROR,
  BUYIN_ERROR,
  SEATING_ERROR,
  IP_MISSING_ERROR,
  SAME_IP_ERROR,
  LOC_PROXMITY_ERROR,
  INVALID_GOOGLE_RECEIPT,
  INVALID_APPSTORE_RECEIPT,
  GAME_CREATION_FAILED,
  UNAUTHORIZED,
  ASSIGN_HOST_FAILED,
  BUYIN_REQUEST_ERROR,
  GAME_NOT_FOUND_ERROR,
  JOIN_FAILED,
  BUYIN_FAILED,
  RELOAD_FAILED,
  TAKEBREAK_FAILED,
  SITBACK_FAILED,
  LEAVE_GAME_FAILED,
  DEALER_CHOICE_FAILED,
  POSTBLIND_FAILED,
  MAXCLUB_REACHED,
  SEAT_RESERVED,
}

export class WaitlistSeatError extends ApolloError {
  constructor(waitingPlayerName: string) {
    const message =
      'A player from waiting list is invited to take the open seat';
    const extensions: any = {};
    extensions['waitingPlayer'] = waitingPlayerName;
    super(message, Errors[Errors.WAITLIST_SEAT_ERROR], extensions);
  }
}

export class IpAddressMissingError extends ApolloError {
  constructor(playerName: string) {
    const message = 'IP address is missing for the player';
    const extensions: any = {};
    extensions['player'] = playerName;
    super(message, Errors[Errors.IP_MISSING_ERROR], extensions);
  }
}

export class SameIpAddressError extends ApolloError {
  constructor(player1: string, player2: string) {
    const message = 'Players have same ip address';
    const extensions: any = {};
    extensions['player1'] = player1;
    extensions['player2'] = player2;
    super(message, Errors[Errors.SAME_IP_ERROR], extensions);
  }
}

export class LocationPromixityError extends ApolloError {
  constructor(player1: string, player2: string) {
    const message = 'Players are close to each other';
    const extensions: any = {};
    extensions['player1'] = player1;
    extensions['player2'] = player2;
    super(message, Errors[Errors.LOC_PROXMITY_ERROR], extensions);
  }
}

export class GoogleReceiptVerifyError extends ApolloError {
  constructor(productId: string, orderId: string) {
    const message = `Verifying google receipt failed. Order Id: ${orderId}`;
    const extensions: any = {};
    extensions['orderId'] = orderId;
    extensions['productId'] = productId;
    super(message, Errors[Errors.INVALID_GOOGLE_RECEIPT], extensions);
  }
}

export class AppleReceiptVerifyError extends ApolloError {
  constructor(productId: string, orderId: string) {
    const message = `Verifying apple receipt failed. Order Id: ${orderId}`;
    const extensions: any = {};
    extensions['orderId'] = orderId;
    extensions['productId'] = productId;
    super(message, Errors[Errors.INVALID_APPSTORE_RECEIPT], extensions);
  }
}

export class GameCreationError extends ApolloError {
  constructor(reason: string) {
    const message = `Creating game failed`;
    const extensions: any = {};
    extensions['reason'] = reason;
    super(message, Errors[Errors.GAME_CREATION_FAILED], extensions);
  }
}

export class UnauthorizedError extends ApolloError {
  constructor() {
    const message = `Unauthorized user`;
    const extensions: any = {};
    super(message, Errors[Errors.UNAUTHORIZED], extensions);
  }
}

export class GenericError extends ApolloError {
  constructor(code: Errors, message: string) {
    super(message, Errors[code]);
  }
}

export class GameNotFoundError extends ApolloError {
  constructor(gameCode: string) {
    const message = `Game ${gameCode} is not found`;
    const extensions: any = {};
    extensions['gameCode'] = gameCode;
    super(message, Errors[Errors.GAME_NOT_FOUND_ERROR], extensions);
  }
}

export class SeatReservedError extends ApolloError {
  constructor(gameCode: string, seatNo: number) {
    const message = `Game ${gameCode}. Seat: ${seatNo} is reserved`;
    const extensions: any = {};
    extensions['gameCode'] = gameCode;
    extensions['seatNo'] = seatNo;
    super(message, Errors[Errors.SEAT_RESERVED], extensions);
  }
}
