import {ClubRepository} from '@src/repositories/club';
import {getLogger} from '@src/utils/log';

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
}

export const AdminAPI = new AdminAPIs();
