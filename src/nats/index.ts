import {Player} from '@src/entity/player';
import {GameType} from '@src/entity/types';
import {getLogger} from '@src/utils/log';
import * as nats from 'nats';

const logger = getLogger('nats');

class NatsClass {
  private client: nats.Client | null = null;

  public init(natsUrls: string) {
    this.client = nats.connect(natsUrls);
    logger.info('Nats is initialized');
  }

  public sendWaitlistMessage(
    gameCode: string,
    gameType: GameType,
    title: string,
    clubName: string,
    player: Player,
    expTime: Date
  ) {
    if (this.client === null) {
      return;
    }
    /*
    {
      "type": "WAITLIST_SEATING",
      "gameCode": "ABCDE",
      "gameType": "HOLDEM",
      "title": "HOLDEM 1/2",
      "clubName": "Manchester Club",
      "expTime": "",
    }
    */
    const message: any = {
      type: 'WAITLIST_SEATING',
      gameCode: gameCode,
      gameType: GameType[gameType],
      title: title,
      clubName: clubName,
      expTime: expTime.toISOString(),
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getPlayerChannel(player);
    this.client.publish(subject, messageStr);
  }

  public getPlayerChannel(player: Player) {
    const subject = `player.${player.id}`;
    return subject;
  }
}

const Nats = new NatsClass();
export {Nats};
