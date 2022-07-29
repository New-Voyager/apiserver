import { Cache } from '@src/cache/index';
import { GameType } from '@src/entity/types';
import { Firebase } from '@src/firebase';
import { Nats } from '@src/nats';
import { errToStr, getLogger } from '@src/utils/log';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

const logger = getLogger('internal::admin');

/**
 * These APIs are only available for testdriver.
 */
class NotificationAPIs {
  public async sendNotification(req: any, resp: any) {

    /*
      {
        type: "notification type",
        payload: {

        }
      }

      e.g.
      send your turn message
      {
        "type": "YOUR_TURN",
        "payload": {
          "gameCode": "12234",
          "playerId": 123
        }
      }
    */
    const type = req.body['type'];
    const payload = req.body['payload']

    const errors = new Array<string>();
    if (!type) {
      errors.push('type is required');
    }
    if (!payload) {
      errors.push('payload is required');
    }
    if (errors.length >= 1) {
      resp.contentType('application/json');
      return resp.status(400).send(JSON.stringify({ errors: errors }));
    }
    try {
      if (type === 'YOUR_TURN') {
        //await this.handleYourTurn(payload);
        const game = await Cache.getGame(payload['gameCode']);
        const player = await Cache.getPlayerById(payload['playerId']);
        const messageId = uuidv4();
        if (game && player) {
          // await Nats.yourTurnMessage(game.gameCode, game.gameType, player, messageId);
          await Firebase.sendYourTurnMessage(game.gameCode, GameType[game.gameType], player, 'It is your turn', messageId);
        }
      }
      resp.status(200).send({ status: 'OK' });
    } catch (err) {
      resp.status(500).send({ status: 'FAILED' });
    }
  }
}

export const NotificationAPI = new NotificationAPIs();
