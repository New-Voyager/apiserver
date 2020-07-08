import {WonAtStatus, GameType} from '@src/entity/hand';
import {HandRepository} from '@src/repositories/hand';

function validateHandData(handData: any): Array<string> {
  const errors = new Array<string>();
  try {
    if (!handData.ClubId) {
      errors.push('ClubId is missing');
    }
    if (!handData.GameNum) {
      errors.push('GameNum is missing');
    }
    if (!handData.HandNum) {
      errors.push('HandNum is missing');
    }
    if (!handData.Players || handData.Players.length === 0) {
      errors.push('Players are missing');
    }
    if (!handData.GameType) {
      errors.push('GameType is missing');
    } else {
      if (
        handData.GameType !== GameType[GameType.HOLDEM] &&
        handData.GameType !== GameType[GameType.OMAHA] &&
        handData.GameType !== GameType[GameType.OMAHA_HILO] &&
        handData.GameType !== GameType[GameType.UNKNOWN]
      ) {
        errors.push('invalid GameType field');
      }
    }
    if (!handData.StartedAt) {
      errors.push('StartedAt is missing');
    }
    if (!handData.EndedAt) {
      errors.push('EndedAt is missing');
    }
    if (!handData.Result) {
      errors.push('Result is missing');
    } else {
      if (
        !handData.Result.pot_winners ||
        handData.Result.pot_winners.length === 0
      ) {
        errors.push('pot_winners is missing');
      }
    }
    if (!handData.Result.won_at) {
      errors.push('won_at is missing');
    } else {
      if (
        handData.Result.won_at !== WonAtStatus[WonAtStatus.FLOP] &&
        handData.Result.won_at !== WonAtStatus[WonAtStatus.PREFLOP] &&
        handData.Result.won_at !== WonAtStatus[WonAtStatus.RIVER] &&
        handData.Result.won_at !== WonAtStatus[WonAtStatus.SHOWDOWN] &&
        handData.Result.won_at !== WonAtStatus[WonAtStatus.TURN]
      ) {
        errors.push('invalid Won_at field');
      }
    }
    if (!handData.Result.pot_winners) {
      errors.push('pot_winners field is missing');
    }
    if (!('showdown' in handData.Result)) {
      errors.push('showdown field is missing');
    } else {
      if (handData.Result.showdown) {
        if (!handData.Result.total_pot) {
          errors.push('total_pot field is missing');
        }
        if (handData.GameType === GameType[GameType.OMAHA_HILO]) {
          if (!handData.Result.hi_winning_cards) {
            errors.push('hi_winning_cards field is missing');
          }
          if (!handData.Result.hi_winning_rank) {
            errors.push('hi_winning_rank field is missing');
          }
          if (!handData.Result.lo_winning_cards) {
            errors.push('lo_winning_cards field is missing');
          }
          if (!handData.Result.lo_winning_rank) {
            errors.push('lo_winning_rank field is missing');
          }
        } else {
          if (!handData.Result.winning_cards) {
            errors.push('winning_cards field is missing');
          }
          if (!handData.Result.rank_num) {
            errors.push('rank_num field is missing');
          }
        }
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
  public async saveHand(req: any, resp: any) {
    const handData = req.body;

    /**
     * Checking for errors
     */
    let errors = new Array<string>();
    errors = validateHandData(handData);

    /**
     * If any data is missing throwing errors
     */
    if (errors.length) {
      if (errors[errors.length - 1] === 'INTERNAL') {
        resp.status(500).send('Internal service error');
        return;
      } else {
        resp.status(500).send(JSON.stringify(errors));
        return;
      }
    }

    /**
     * Saving the data
     */
    const res = await HandRepository.saveHand(handData);
    if (res === true) {
      resp.status(200).send(JSON.stringify({status: 'OK'}));
    } else {
      resp.status(500).send(JSON.stringify(res));
    }
  }
}

export const HandServerAPI = new HandServerAPIs();
