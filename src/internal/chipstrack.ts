import {ChipsTrackRepository} from '@src/repositories/chipstrack';
import {getLogger} from '@src/utils/log';
const logger = getLogger('chipstrack');

export async function saveChipsData(registerPayload: any) {
  const res = await ChipsTrackRepository.saveChips(registerPayload);
  return res;
}

export async function buyChipsData(registerPayload: any) {
  const res = await ChipsTrackRepository.buyChips(registerPayload);
  return res;
}

class ChipsTrackAPIs {
  /**
   * @param req request object
   * @param resp response object
   */
  public async playerSitsIn(req: any, resp: any) {
    const registerPayload = req.body;

    const errors = new Array<string>();
    if (!registerPayload.clubId && registerPayload.clubId !== 0) {
      errors.push('ClubId is missing');
    }
    if (!registerPayload.playerId) {
      errors.push('PlayerId is missing');
    }
    if (!registerPayload.seatNo) {
      errors.push('PlayerId is missing');
    }
    if (!registerPayload.gameId) {
      errors.push('Seat Number is missing');
    }
    if (
      registerPayload.status === 'BLOCKED' ||
      registerPayload.status === 'KICKED_OUT' ||
      registerPayload.status === 'LEFT'
    ) {
      errors.push('invalid status field');
    }

    if (errors.length) {
      resp.status(500).send(JSON.stringify(errors));
      return;
    }

    try {
      const res = await saveChipsData(registerPayload);
      if (res) {
        resp.status(200).send(JSON.stringify({status: 'OK', id: res}));
      } else {
        logger.error('Error');
        resp.status(500).send(JSON.stringify(res));
      }
    } catch (err) {
      resp.status(500);
      return;
    }
  }

  /**
   * @param req request object
   * @param resp response object
   */
  public async endGame(req: any, resp: any) {
    const registerPayload = req.body;

    const errors = new Array<string>();
    if (!registerPayload.club_id && registerPayload.club_id !== 0) {
      logger.error('club_id is missing');
    }
    if (!registerPayload.game_id) {
      logger.error('game_id  is missing');
    }

    if (errors.length) {
      resp.status(500).send(JSON.stringify(errors));
      return;
    }

    try {
      const res = true;
      if (res === true) {
        resp.status(200).send(JSON.stringify({status: 'OK', data: res}));
      } else {
        resp.status(500).send(JSON.stringify(res));
      }
    } catch (err) {
      resp.status(500);
      return;
    }
  }

  public async buyChips(req: any, resp: any) {
    const registerPayload = req.body;
    const errors = new Array<string>();
    if (!registerPayload.clubId && registerPayload.clubId !== 0) {
      errors.push('ClubId is missing');
    }
    if (!registerPayload.playerId) {
      errors.push('PlayerId is missing');
    }
    if (!registerPayload.gameId) {
      errors.push('GameId is missing');
    }
    if (!registerPayload.buyChips) {
      errors.push('Chips is missing');
    }
    if (errors.length) {
      resp.status(500).send(JSON.stringify(errors));
      return;
    }

    try {
      const res = await buyChipsData(registerPayload);
      if (res) {
        resp.status(200).send(JSON.stringify({status: 'OK', id: res}));
      } else {
        logger.error('Error');
        resp.status(500).send(JSON.stringify(res));
      }
    } catch (err) {
      logger.error(`
        Error when buying chips. Message: ${err.message}
      `);
      console.log(err);
      resp.status(500).send(JSON.stringify({error: err.message}));
      return;
    }
  }
}
export const ChipsTrackSeverAPI = new ChipsTrackAPIs();
