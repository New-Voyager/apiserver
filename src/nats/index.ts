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

  /*
    Used for sending an update to the app to refresh the club screen.
    changed: What changed in the club
      CLUB_CHAT, PENDING_APPROVAL, NEW_MEMBER, MEMBER_APPROVED, MEMBER_DENIED,
      HOST_MESSAGE, ANNOUNCEMENT, NEW_GAME
  */
  public sendClubUpdate(
    clubCode: string,
    clubName: string,
    changed: string,
    messageId: string
  ) {
    if (this.client === null) {
      return;
    }
    /*
    {
      "type": "CLUB_UPDATED",
      "clubName": "Manchester Club",
      "clubCode": "<>"
    }
    */
    const message: any = {
      type: 'CLUB_UPDATED',
      clubCode: clubCode,
      clubName: clubName,
      changed: changed,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getClubChannel(clubCode);
    this.client.publish(subject, messageStr);
  }

  public sendDealersChoiceMessage(
    game: PokerGame,
    playerId: number,
    timeout: number
  ) {
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
            timeout: timeout,
          },
        },
      ],
    };
    const channel = this.getPlayerHandChannel(game.gameCode, playerId);
    const messageStr = JSON.stringify(message);
    this.client.publish(channel, messageStr);
  }

  public sendSeatChangePrompt(
    gameCode: string,
    openedSeat: number,
    playerId: number,
    playerUuid: string,
    name: string,
    expTime: Date,
    expSeconds: number
  ) {
    if (this.client === null) {
      return;
    }
    const tick = new Date().getTime();

    const messageId = `SEATCHANGE:${tick}`;

    /*
    {
      "type": "PLAYER_SEAT_CHANGE_PROMPT",
      "gameCode": "ABCDE",
      "expTime": "ISO time stamp",
      "playerId": <player id>,
      "playerUuid": <player uuid>,
      "requestId": messageId,
    }
    */
    const message: any = {
      type: 'PLAYER_SEAT_CHANGE_PROMPT',
      gameCode: gameCode,
      openedSeat: openedSeat,
      playerName: name,
      playerId: playerId,
      playerUuid: playerUuid,
      expTime: expTime.toISOString(),
      promptSecs: expSeconds,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(gameCode);
    this.client.publish(subject, messageStr);
  }

  public sendPlayerSeatMove(
    gameCode: string,
    playerId: number,
    playerUuid: string,
    name: string,
    oldSeatNo: number,
    newSeatNo: number
  ) {
    if (this.client === null) {
      return;
    }
    const tick = new Date().getTime();

    const messageId = `SEATMOVE:${tick}`;

    const message: any = {
      type: 'PLAYER_SEAT_MOVE',
      gameCode: gameCode,
      playerName: name,
      playerId: playerId,
      playerUuid: playerUuid,
      oldSeatNo: oldSeatNo,
      newSeatNo: newSeatNo,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(gameCode);
    this.client.publish(subject, messageStr);
  }

  public sendPlayerSeatChangeDeclined(
    gameCode: string,
    playerId: number,
    playerUuid: string,
    name: string
  ) {
    if (this.client === null) {
      return;
    }
    const tick = new Date().getTime();

    const messageId = `SEATMOVE:${tick}`;

    const message: any = {
      type: 'PLAYER_SEAT_CHANGE_DECLINED',
      gameCode: gameCode,
      playerName: name,
      playerId: playerId,
      playerUuid: playerUuid,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(gameCode);
    this.client.publish(subject, messageStr);
  }

  public sendPlayerSeatChangeStart(gameCode: string) {
    if (this.client === null) {
      return;
    }
    const tick = new Date().getTime();

    const messageId = `SEATMOVE:${tick}`;

    const message: any = {
      type: 'PLAYER_SEAT_CHANGE_START',
      gameCode: gameCode,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(gameCode);
    this.client.publish(subject, messageStr);
  }

  public sendPlayerSeatChangeDone(gameCode: string) {
    if (this.client === null) {
      return;
    }
    const tick = new Date().getTime();

    const messageId = `SEATMOVE:${tick}`;

    const message: any = {
      type: 'PLAYER_SEAT_CHANGE_DONE',
      gameCode: gameCode,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(gameCode);
    this.client.publish(subject, messageStr);
  }

  public getPlayerChannel(player: Player) {
    const subject = `player.${player.id}`;
    return subject;
  }

  public getClubChannel(clubCode: string) {
    const subject = `club.${clubCode}`;
    return subject;
  }

  public getGameChannel(gameCode: string) {
    const subject = `game.${gameCode}.player`;
    return subject;
  }

  public getPlayerHandChannel(gameCode: string, playerId: number) {
    return `hand.${gameCode}.player.${playerId}`;
  }
}

const Nats = new NatsClass();
export {Nats};
