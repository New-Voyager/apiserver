import {getRepository} from 'typeorm';
import {PlayerStatus, PlayerGameTracker} from '@src/entity/chipstrack';
import {ChipsTrackRepository} from '@src/repositories/chipstrack';
import {STATUS_CODES} from 'http';
import {getLogger} from '@src/utils/log';
const logger = getLogger('chipstrack');

class ChipsTrackAPIs {
  /**
   * @param req request object
   * @param resp response object
   */
  public async playerSitsIn(req: any, resp: any) {
    const registerPayload = req.body;

    const errors = new Array<string>();
    if (!registerPayload.clubId) {
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
      const res = await ChipsTrackRepository.saveChips(registerPayload);
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

  public async buyChips(req: any, resp: any) {
    const registerPayload = req.body;

    const errors = new Array<string>();
    if (!registerPayload.clubId) {
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
      const res = await ChipsTrackRepository.buyChips(registerPayload);
      logger.debug(res);
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
}
export const ChipsTrackSeverAPI = new ChipsTrackAPIs();
