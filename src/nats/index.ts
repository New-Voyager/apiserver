import {PokerGame} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {GameType} from '@src/entity/types';
import {HighHandWinner, NewUpdate} from '@src/repositories/types';
import {getLogger} from '@src/utils/log';
import * as nats from 'nats';
import {v4 as uuidv4} from 'uuid';
import {Cache} from '@src/cache';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
const logger = getLogger('nats');

class NatsClass {
  private client: nats.NatsConnection | null = null;
  private stringCodec: nats.Codec<string> = nats.StringCodec();

  public async init(natsUrls: string) {
    const connOpts = {
      servers: natsUrls.split(','),
    };
    this.client = await nats.connect(connOpts);
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
    this.client.publish(subject, this.stringCodec.encode(messageStr));
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
    this.client.publish(subject, this.stringCodec.encode(messageStr));
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
    const subject = this.getPlayerHandChannel(game.gameCode, playerId);
    const messageStr = JSON.stringify(message);
    this.client.publish(subject, this.stringCodec.encode(messageStr));
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
    this.client.publish(subject, this.stringCodec.encode(messageStr));
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
    this.client.publish(subject, this.stringCodec.encode(messageStr));
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
    this.client.publish(subject, this.stringCodec.encode(messageStr));
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
    this.client.publish(subject, this.stringCodec.encode(messageStr));
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
    this.client.publish(subject, this.stringCodec.encode(messageStr));
  }

  public sendReloadApproved(
    gameCode: string,
    playerId: number,
    playerUuid: string,
    name: string,
    oldStack: number,
    newStack: number,
    reloadAmount: number
  ) {
    if (this.client === null) {
      return;
    }
    const tick = new Date().getTime();

    const messageId = `RELOADAPPROVED:${tick}`;

    const message: any = {
      type: 'STACK_RELOADED',
      subType: 'APPROVED',
      gameCode: gameCode,
      playerName: name,
      playerId: playerId,
      playerUuid: playerUuid,
      requestId: messageId,
      oldStack: oldStack,
      newStack: newStack,
      reloadAmount: reloadAmount,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(gameCode);
    this.client.publish(subject, this.stringCodec.encode(messageStr));
  }

  public sendReloadApprovalRequest(
    game: PokerGame,
    clubName: string,
    requestingPlayer: Player,
    host: Player,
    messageId: string
  ) {
    if (this.client === null) {
      return;
    }
    const message: any = {
      type: 'RELOAD_REQUEST',
      gameCode: game.gameCode,
      gameType: GameType[game.gameType],
      smallBlind: game.smallBlind,
      bigBlind: game.bigBlind,
      clubName: clubName,
      requestingPlayerId: requestingPlayer.id,
      requestingPlayerName: requestingPlayer.name,
      requestingPlayerUuid: requestingPlayer.uuid,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getPlayerChannel(host);
    this.client.publish(subject, this.stringCodec.encode(messageStr));
  }

  public sendReloadWaitTime(
    game: PokerGame,
    clubName: string,
    requestingPlayer: Player,
    waitTime: number,
    messageId: string
  ) {
    if (this.client === null) {
      return;
    }
    const message: any = {
      type: 'RELOAD_REQUEST_WAIT_FOR_APPROVAL',
      gameCode: game.gameCode,
      requestingPlayerId: requestingPlayer.id,
      requestingPlayerName: requestingPlayer.name,
      requestingPlayerUuid: requestingPlayer.uuid,
      waitTime: waitTime,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getPlayerChannel(requestingPlayer);
    this.client.publish(subject, this.stringCodec.encode(messageStr));
  }

  public sendReloadTimeout(
    game: PokerGame,
    requestingPlayer: Player,
    messageId: string
  ) {
    if (this.client === null) {
      return;
    }
    const message: any = {
      type: 'RELOAD_TIMEOUT',
      gameCode: game.gameCode,
      requestingPlayerId: requestingPlayer.id,
      requestingPlayerName: requestingPlayer.name,
      requestingPlayerUuid: requestingPlayer.uuid,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getPlayerChannel(requestingPlayer);
    this.client.publish(subject, this.stringCodec.encode(messageStr));
  }

  public async notifyAppCoinShort(game: PokerGame) {
    if (this.client === null) {
      return;
    }
    const player = await Cache.getPlayer(game.hostUuid);
    if (player) {
      const messageId = `APPCOIN:${uuidv4()}`;
      const message: any = {
        type: 'APPCOIN_NEEDED',
        gameCode: game.gameCode,
        requestId: messageId,
      };
      const messageStr = JSON.stringify(message);
      const subject = this.getPlayerChannel(player);
      this.client.publish(subject, this.stringCodec.encode(messageStr));
    }
  }

  public async notifyPlayerSwitchSeat(
    game: PokerGame,
    player: Player,
    playerGameInfo: PlayerGameTracker,
    oldSeatNo: number,
    messageId?: string
  ) {
    if (this.client === null) {
      return;
    }

    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'TABLE_UPDATE',
      subType: NewUpdate[NewUpdate.SWITCH_SEAT],
      gameId: game.id,
      playerId: player.id,
      playerUuid: player.uuid,
      name: player.name,
      oldSeatNo: oldSeatNo,
      seatNo: playerGameInfo.seatNo,
      stack: playerGameInfo.stack,
      status: playerGameInfo.status,
      buyIn: playerGameInfo.buyIn,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.client.publish(subject, this.stringCodec.encode(messageStr));
  }

  public async notifyPlayerSeatReserve(
    game: PokerGame,
    player: Player,
    seatNo: number,
    messageId?: string
  ) {
    if (this.client === null) {
      return;
    }

    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'TABLE_UPDATE',
      subType: NewUpdate.RESERVE_SEAT[NewUpdate.RESERVE_SEAT],
      gameId: game.id,
      playerId: player.id,
      playerUuid: player.uuid,
      name: player.name,
      seatNo: seatNo,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.client.publish(subject, this.stringCodec.encode(messageStr));
  }

  /*
  message HighHandWinner {
    uint64 player_id = 1;
    string player_name = 2;
    uint32 hh_rank = 3;
    repeated uint32 hh_cards = 4;
    repeated uint32 player_cards = 5;
    uint32 seat_no = 6;
  }

  message HighHand {
    string gameCode = 1;
    uint32 hand_num = 2;
    repeated HighHandWinner winners = 3;
  }

  {
    "boardCards": [],
    "rank": 1,
    "gameCode": "",
    "handNum": 1,
    "winners": [
      "hhCards": [],
      "playerCards": [],
    ]
  }
  */
  public sendHighHandWinners(
    game: PokerGame,
    boardCards: Array<number>,
    handNum: number,
    winners: Array<HighHandWinner>,
    messageId?: string
  ) {
    if (this.client === null) {
      return;
    }

    if (!messageId) {
      messageId = uuidv4();
    }

    const message: any = {
      type: 'NEW_HIGHHAND_WINNER',
      gameCode: game.gameCode,
      handNum: handNum,
      boardCards: boardCards,
      winners: winners,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.client.publish(subject, this.stringCodec.encode(messageStr));
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
    //"hand.cgweebfa.player.694"
    return `hand.${gameCode}.player.${playerId}`;
  }
}

const Nats = new NatsClass();
export {Nats};
