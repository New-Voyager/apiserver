import {ClubRepository} from '@src/repositories/club';
import {Club} from '@src/entity/club';

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
    await ClubRepository.deleteClubByName(clubName);
    resp.status(200).send({status: 'OK'});
  }
}

export const AdminAPI = new AdminAPIs();
