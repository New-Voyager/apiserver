import {PokerGame} from '@src/entity/game';
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
    game: PokerGame,
    title: string,
    clubName: string,
    player: Player,
    expTime: Date,
    messageId: string
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
      smallBlind: game.smallBlind,
      bigBlind: game.bigBlind,
      title: title,
      clubName: clubName,
      expTime: expTime.toISOString(),
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getPlayerChannel(player);
    this.client.publish(subject, messageStr);
  }

  public sendDealersChoiceMessage(game: PokerGame, playerId: number) {
    if (this.client === null) {
      return;
    }
    const tick = new Date().getTime();
    const message: any = {
      version: '1.0',
      gameCode: game.gameCode,
      playerId: playerId.toString(),
      gameToken: '',
      messageId: `DEALERCHOICE:${tick}`,
      messages: [
        {
          messageType: 'DEALER_CHOICE',
          dealerChoice: {
            playerId: playerId.toString(),
            games: game.dealerChoiceGames.split(',').map(e => GameType[e]),
          },
        },
      ],
    };
    const channel = this.getPlayerHandChannel(game.gameCode, playerId);
    const messageStr = JSON.stringify(message);
    this.client.publish(channel, messageStr);
  }

  public getPlayerChannel(player: Player) {
    const subject = `player.${player.id}`;
    return subject;
  }

  public getPlayerHandChannel(gameCode: string, playerId: number) {
    return `hand.${gameCode}.player.${playerId}`;
  }
}

const Nats = new NatsClass();
export {Nats};
