// Application specific errors go here

import {ApolloError} from 'apollo-server-errors';

enum Errors {
  WAITLIST_SEAT_ERROR,
  BUYIN_ERROR,
  SEATING_ERROR,
  IP_MISSING_ERROR,
  SAME_IP_ERROR,
  LOC_PROXMITY_ERROR,
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
