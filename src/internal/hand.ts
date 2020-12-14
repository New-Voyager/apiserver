import {WonAtStatus} from '@src/entity/types';
import {HandRepository} from '@src/repositories/hand';

function validateHandData(handData: any): Array<string> {
  const errors = new Array<string>();
  try {
    if (!handData.clubId && handData.clubId !== 0) {
      errors.push('clubId is missing');
    }
    if (!handData.gameId) {
      errors.push('gameId is missing');
    }
    if (!handData.handNum) {
      errors.push('handNum is missing');
    }
    if (!handData.handResult) {
      errors.push('handResult is missing');
    } else {
      if (!handData.handResult.potWinners) {
        errors.push('potWinners is missing');
      } else {
        if (!handData.handResult.potWinners[0]) {
          errors.push('potWinners of 0 is missing');
        } else {
          if (
            !handData.handResult.potWinners[0].hiWinners ||
            handData.handResult.potWinners[0].hiWinners.length === 0
          ) {
            errors.push('hiWinners are missing');
          }
        }
      }
      if (!handData.handResult.handStartedAt) {
        errors.push('handStartedAt is missing');
      }
      if (!handData.handResult.handEndedAt) {
        errors.push('handEndedAt is missing');
      }
      if (
        !handData.handResult.playersInSeats ||
        handData.handResult.playersInSeats.length === 0
      ) {
        errors.push('playersInSeats is missing');
      }
      if (!handData.handResult.wonAt) {
        errors.push('wonAt is missing');
      } else {
        if (
          handData.handResult.wonAt !== WonAtStatus[WonAtStatus.FLOP] &&
          handData.handResult.wonAtt !== WonAtStatus[WonAtStatus.PREFLOP] &&
          handData.handResult.wonAt !== WonAtStatus[WonAtStatus.RIVER] &&
          handData.handResult.wonAt !== WonAtStatus[WonAtStatus.SHOW_DOWN] &&
          handData.handResult.wonAt !== WonAtStatus[WonAtStatus.TURN]
        ) {
          errors.push('invalid wonAt field');
        }
      }
      if (!handData.handResult.tips) {
        errors.push('tips is missing');
      }
      if (
        !handData.handResult.balanceAfterHand ||
        handData.handResult.balanceAfterHand.length === 0
      ) {
        errors.push('balanceAfterHand are missing');
      }
    }
    if (handData.handResult.qualifyingPromotionWinner) {
      if (!handData.handResult.qualifyingPromotionWinner.promoId) {
        errors.push('promoId field is missing');
      }
      if (!handData.handResult.qualifyingPromotionWinner.playerId) {
        errors.push('playerId field is missing');
      }
    }
  } catch (err) {
    errors.push('INTERNAL');
    return errors;
  }
  return errors;
}

/**
 * Hand Server API class
 */
class HandServerAPIs {
  public async postHand(req: any, resp: any) {
    const gameID = parseInt(req.params.gameId, 10);
    if (!gameID) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const handNum = parseInt(req.params.handNum, 10);
    if (!handNum) {
      const res = {error: 'Invalid hand number'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const result = req.body;
    await postHand(gameID, handNum, result);
    resp.status(200).send({status: 'OK'});
  }
}

export const HandServerAPI = new HandServerAPIs();

export async function postHand(gameID: number, handNum: number, result: any) {
  const res = await HandRepository.saveHandNew(gameID, handNum, result);
  return res;
}
