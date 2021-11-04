import {ClubRepository} from '@src/repositories/club';
import {HandRepository} from '@src/repositories/hand';
import {Cache} from '@src/cache/index';
import {errToStr, getLogger} from '@src/utils/log';
import {HistoryRepository} from '@src/repositories/history';
import {GameNotFoundError} from '@src/errors';
import {cardNumber, stringCards} from '@src/utils';
import _ from 'lodash';
import assert from 'assert';
import {AdminRepository} from '@src/repositories/admin';

const logger = getLogger('internal::admin');

/**
 * These APIs are only available for testdriver.
 */
class AdminAPIs {
  public async deleteClub(req: any, resp: any) {
    const clubName = req.params.clubName;
    if (!clubName) {
      const res = {error: 'Invalid club name'};
      resp.status(500).send(JSON.stringify(res));
    }
    try {
      await ClubRepository.deleteClubByName(clubName);
      resp.status(200).send({status: 'OK'});
    } catch (err) {
      logger.error(errToStr(err));
      resp.status(500).send({error: errToStr(err)});
    }
  }

  public async dataRetention(req: any, resp: any) {
    try {
      const handHistoryDeleted = await HandRepository.cleanUpOldData();
      resp.status(200).send({handHistory: handHistoryDeleted});
    } catch (err) {
      logger.error(`Error in data retention process: ${errToStr(err)}`);
      resp.status(500).json({error: errToStr(err)});
    }
  }

  public async handAnalysis(req: any, resp: any) {
    const gameCode = req.params.gameCode;
    try {
      if (!gameCode) {
        const res = {error: 'Invalid game code'};
        resp.status(500).send(JSON.stringify(res));
        return;
      }
      const ret = await AdminRepository.analyzeHands(gameCode);

      resp.status(200).send(ret);
    } catch (err) {
      logger.error(
        `Could get hand history for game ${gameCode}. Error: ${errToStr(err)}`
      );
      resp.status(500).json({error: errToStr(err)});
    }
  }
}

export const AdminAPI = new AdminAPIs();
