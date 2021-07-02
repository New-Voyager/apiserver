// Application specific errors go here

import {ApolloError} from 'apollo-server-errors';

enum Errors {
  WAITLIST_SEAT_ERROR,
  BUYIN_ERROR,
  SEATING_ERROR,
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
