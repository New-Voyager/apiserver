import {PlayerRepository} from '@src/repositories/player';
import {errToStr, getLogger} from '@src/utils/log';

const logger = getLogger('internal::user');

class UserAPIs {
  public async getEncryptionKey(req: any, resp: any) {
    try {
      const playerId = req.params.playerID;
      if (!playerId) {
        throw new Error(`Player id must be provided`);
      }
      const player = await PlayerRepository.getPlayerByDBId(playerId);
      if (!player) {
        throw new Error(`Could not find player ID ${playerId}`);
      }
      resp.status(200).json({status: 'OK', key: player.encryptionKey});
    } catch (err) {
      logger.error(`Error getting encryption key: ${errToStr(err)}`);
      resp.status(500).json({error: errToStr(err)});
    }
  }
}

export const UserAPI = new UserAPIs();
