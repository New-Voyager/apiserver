import {PokerGame} from '@src/entity/game';
import {getLogger} from '@src/utils/log';
import {getRepository} from 'typeorm';
import {WAITLIST_SEATING} from './types';
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
    handleWaitList(gameID, playerID);
  }

  resp.status(200).send({status: 'OK'});
}

async function handleWaitList(gameID: number, playerID: number) {
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
