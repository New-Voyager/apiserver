import {PokerGame} from '@src/entity/game';
import {getLogger} from '@src/utils/log';
import {getRepository} from 'typeorm';
import {SeatChangeProcess} from './seatchange';
import {SEATCHANGE_PROGRSS, WAITLIST_SEATING, BUYIN_TIMEOUT} from './types';
import {WaitListMgmt} from './waitlist';

const logger = getLogger('timer');

export async function timerCallback(req: any, resp: any) {
  const gameID = req.params.gameID;
  if (!gameID) {
    const res = {error: 'Invalid game id'};
    resp.status(500).send(JSON.stringify(res));
    return;
  }

  const playerID = req.params.playerID;
  if (!playerID) {
    const res = {error: 'Invalid player id'};
    resp.status(500).send(JSON.stringify(res));
    return;
  }

  const purpose = req.params.purpose;
  if (!purpose) {
    const res = {error: 'Invalid player id'};
    resp.status(500).send(JSON.stringify(res));
    return;
  }

  logger.info(
    `Timer callback for game: ${gameID} player: ${playerID} purpose: ${purpose}`
  );

  if (purpose === WAITLIST_SEATING) {
    waitlistTimeoutExpired(gameID, playerID);
  } else if (purpose === SEATCHANGE_PROGRSS) {
    seatChangeTimeoutExpired(gameID);
  } else if (purpose === BUYIN_TIMEOUT) {
    buyInTimeoutExpired(gameID, playerID);
  }

  resp.status(200).send({status: 'OK'});
}

export async function waitlistTimeoutExpired(gameID: number, playerID: number) {
  logger.info(
    `Wait list timer expired. GameID: ${gameID}, PlayerID: ${playerID}. Go to next player`
  );
  const gameRepository = getRepository(PokerGame);
  const game = await gameRepository.findOne({id: gameID});
  if (!game) {
    throw new Error(`Game: ${gameID} is not found`);
  }

  const waitlistMgmt = new WaitListMgmt(game);
  await waitlistMgmt.runWaitList();
}

export async function seatChangeTimeoutExpired(gameID: number) {
  logger.info(`Seat change timeout expired. GameID: ${gameID}`);
  const gameRepository = getRepository(PokerGame);
  const game = await gameRepository.findOne({id: gameID});
  if (!game) {
    throw new Error(`Game: ${gameID} is not found`);
  }
  const seatChange = new SeatChangeProcess(game);
  await seatChange.finish();
}

export async function buyInTimeoutExpired(gameID: number, playerID: number) {
  logger.info(
    `Buyin timeout expired. GameID: ${gameID}, playerID: ${playerID}`
  );
  const gameRepository = getRepository(PokerGame);
  const game = await gameRepository.findOne({id: gameID});
  if (!game) {
    throw new Error(`Game: ${gameID} is not found`);
  }

  // handle buyin timeout
}
