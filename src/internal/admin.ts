import {ClubRepository} from '@src/repositories/club';
import {HandRepository} from '@src/repositories/hand';
import {errToLogString, getLogger} from '@src/utils/log';

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
      logger.error(err.message);
      resp.status(500).send({error: err.message});
    }
  }

  public async dataRetention(req: any, resp: any) {
    try {
      const res = await HandRepository.cleanUpOldData();
      resp.status(200).send({status: 'OK'});
    } catch (err) {
      logger.error(`Error in data retention process: ${errToLogString(err)}`);
      resp.status(500).json({error: errToLogString(err, false)});
    }
  }
}

export const AdminAPI = new AdminAPIs();
