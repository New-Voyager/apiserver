import {PokerGame, PokerGameSettings} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {
  GameStatus,
  GameType,
  PlayerStatus,
  TableStatus,
} from '@src/entity/types';
import {HighHandWinner, NewUpdate} from '@src/repositories/types';
import {errToStr, getLogger} from '@src/utils/log';
import * as nats from 'nats';
import {v4 as uuidv4} from 'uuid';
import {Cache} from '@src/cache';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import * as Constants from '../const';
import {SeatMove, SeatUpdate} from '@src/types';
import {SageMakerFeatureStoreRuntime} from 'aws-sdk';
import {getAppSettings} from '@src/firebase';
import {centsToChips} from '@src/utils';
import {TableUpdateReserveSeat} from '../const';
import {TournamentRepository} from '@src/repositories/tournament';
import {TournamentData, TournamentStatus} from '@src/repositories/balance';

const logger = getLogger('nats');

class NatsClass {
  private client: nats.NatsConnection | null = null;
  private stringCodec: nats.Codec<string> = nats.StringCodec();
  private natsUrls: string = '';
  private natsEnabled: boolean = false;
  public async connect() {
    try {
      const connOpts = {
        servers: this.natsUrls.split(','),
      };
      logger.info(
        `Connecting to NATS url: ${this.natsUrls}. Options: ${JSON.stringify(
          connOpts
        )}`
      );
      this.client = await nats.connect(connOpts);
    } catch (err) {
      logger.error(
        `Cannot connect to urls: ${this.natsUrls}. Error: ${errToStr(err)}`
      );
      throw err;
    }
  }

  public async init(natsUrls: string) {
    try {
      this.natsEnabled = true;
      this.natsUrls = natsUrls;
      this.connect();
      logger.info('Nats is initialized');
    } catch (err) {
      logger.error(
        `Cannot connect to urls: ${natsUrls}. Error: ${errToStr(err)}`
      );
      throw err;
    }
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
      smallBlind: centsToChips(game.smallBlind),
      bigBlind: centsToChips(game.bigBlind),
      title: title,
      clubName: clubName,
      waitlistPlayerId: player.id,
      expTime: expTime.toISOString(),
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getPlayerChannel(player);
    const gameChannel = this.getGameChannel(gameCode);
    this.sendMessage(subject, messageStr);
    this.sendMessage(gameChannel, messageStr);
  }

  public sendCreditMessage(
    clubCode: string,
    clubName: string,
    player: Player,
    text: string,
    messageId: string
  ) {
    const message: any = {
      type: 'CREDIT_UPDATE',
      clubName: clubName,
      clubCode: clubCode,
      text: text,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getPlayerChannel(player);
    this.sendMessage(subject, messageStr);
  }

  public sendGameEndingMessage(gameCode: string, messageId: string) {
    /*
    {
      "type": "GAME_ENDING",
      "gameCode": "ABCDE",
    }
    */
    const message: any = {
      type: 'GAME_ENDING',
      gameCode: gameCode,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const gameChannel = this.getGameChannel(gameCode);
    this.sendMessage(gameChannel, messageStr);
  }

  public sendTestMessage(player: Player, message: any) {
    const messageStr = JSON.stringify(message);
    const channel = this.getPlayerChannel(player);
    this.sendMessage(channel, messageStr);
  }

  private sendMessageInternal(channel: string, messageStr: string) {
    if (this.client === null) {
      this.connect()
        .then(e => {
          if (this.client !== null) {
            this.client.publish(channel, this.stringCodec.encode(messageStr));
          }
        })
        .catch(e => {
          return;
        });
    }
    if (this.client === null) {
      return;
    }

    this.client.publish(channel, this.stringCodec.encode(messageStr));
  }

  public sendMessage(channel: string, messageStr: string) {
    try {
      if (!this.natsEnabled) {
        return;
      }
      this.sendMessageInternal(channel, messageStr);
    } catch (err) {
      if (this.client !== null) {
        this.client.close();
      }
      this.client = null;
      try {
        setTimeout(() => {
          this.sendMessageInternal(channel, messageStr);
        }, 5000);
      } catch (err) {
        this.client = null;
        logger.error('Failed to send message');
      }
    }
  }

  /*
    Used for sending an update to the app to refresh the club screen.
    changed: What changed in the club
      CLUB_CHAT, PENDING_APPROVAL, NEW_MEMBER, MEMBER_APPROVED, MEMBER_DENIED,
      HOST_MESSAGE, ANNOUNCEMENT, NEW_GAME, BUYIN_REQUEST
  */
  public sendClubUpdate(
    clubCode: string,
    clubName: string,
    changed: string,
    messageId: string,
    data?: any
  ) {
    /*
    {
      "type": "CLUB_UPDATED",
      "clubName": "Manchester Club",
      "clubCode": "<>"
    }
    */
    let message: any = {
      type: 'CLUB_UPDATED',
      clubCode: clubCode,
      clubName: clubName,
      changed: changed,
      requestId: messageId,
    };

    if (data) {
      message = Object.assign(message, data);
    }
    const messageStr = JSON.stringify(message);
    const subject = this.getClubChannel(clubCode);
    this.sendMessage(subject, messageStr);
  }

  public sendPlayerGameUpdate(
    playerId: number,
    playerUuid: string,
    game: PokerGame,
    gameStatus: GameStatus,
    messageId: string,
    data?: any
  ) {
    /*
    {
      "type": "CLUB_UPDATED",
      "clubName": "Manchester Club",
      "clubCode": "<>"
    }
    */
    let message: any = {
      type: 'GAME_STATUS_CHANGE',
      gameCode: game.gameCode,
      status: GameStatus[gameStatus],
      requestId: messageId,
    };

    if (data) {
      message = Object.assign(message, data);
    }
    const messageStr = JSON.stringify(message);
    const subject = this.getPlayerChannelUsingId(playerId);
    this.sendMessage(subject, messageStr);
  }

  public async notifyDealerChoicePrompt(
    game: PokerGame,
    playerId: number,
    messageId?: string
  ) {
    if (this.client === null) {
      return;
    }

    if (!messageId) {
      messageId = uuidv4();
    }

    const message: any = {
      type: 'DEALER_CHOICE_PROMPT',
      gameId: game.id,
      gameCode: game.gameCode,
      playerId: playerId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  public async notifyDealerChoiceGame(
    game: PokerGame,
    playerId: number,
    gameType: GameType,
    doubleBoard: boolean,
    messageId?: string
  ) {
    if (this.client === null) {
      return;
    }

    if (!messageId) {
      messageId = uuidv4();
    }

    const message: any = {
      type: 'DEALER_CHOICE_GAME',
      gameId: game.id,
      gameCode: game.gameCode,
      playerId: playerId,
      gameType: GameType[gameType],
      doubleBoard: doubleBoard,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  public sendDealersChoiceMessage(
    game: PokerGame,
    gameSettings: PokerGameSettings,
    playerId: number,
    handNum: number,
    timeout: number
  ) {
    const tick = new Date().getTime();
    const message: any = {
      version: '1.0',
      gameCode: game.gameCode,
      playerId: playerId,
      gameToken: '',
      messageId: `DEALERCHOICE:${tick}`,
      messageType: 'DEALER_CHOICE',
      handNum: handNum,
      dealerChoiceGames: gameSettings.dealerChoiceGames
        .split(',')
        .map(e => GameType[e]),
      timeout: timeout,
    };
    const subject = this.getPlayerHandTextChannel(game.gameCode, playerId);
    const messageStr = JSON.stringify(message);
    this.sendMessage(subject, messageStr);
    logger.verbose(
      `[${game.id}:${game.gameCode}] Sending dealer choice message ${messageStr}`
    );
  }

  public sendSeatChangePrompt(
    gameCode: string,
    openedSeat: number,
    playerId: number,
    playerUuid: string,
    playerName: string,
    expTime: Date,
    expSeconds: number
  ) {
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
      playerName: playerName,
      playerId: playerId,
      playerUuid: playerUuid,
      expTime: expTime.toISOString(),
      promptSecs: expSeconds,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(gameCode);
    this.sendMessage(subject, messageStr);
  }

  public sendPlayerSeatMove(
    gameCode: string,
    playerId: number,
    playerUuid: string,
    playerName: string,
    oldSeatNo: number,
    newSeatNo: number
  ) {
    const tick = new Date().getTime();

    const messageId = `SEATMOVE:${tick}`;

    const message: any = {
      type: 'PLAYER_SEAT_MOVE',
      gameCode: gameCode,
      playerName: playerName,
      playerId: playerId,
      playerUuid: playerUuid,
      oldSeatNo: oldSeatNo,
      newSeatNo: newSeatNo,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(gameCode);
    this.sendMessage(subject, messageStr);
  }

  public sendPlayerSeatChangeDeclined(
    gameCode: string,
    playerId: number,
    playerUuid: string,
    playerName: string
  ) {
    const tick = new Date().getTime();

    const messageId = `SEATMOVE:${tick}`;

    const message: any = {
      type: 'PLAYER_SEAT_CHANGE_DECLINED',
      gameCode: gameCode,
      playerName: playerName,
      playerId: playerId,
      playerUuid: playerUuid,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(gameCode);
    this.sendMessage(subject, messageStr);
  }

  public sendPlayerSeatChangeStart(gameCode: string) {
    const tick = new Date().getTime();

    const messageId = `SEATMOVE:${tick}`;

    const message: any = {
      type: 'PLAYER_SEAT_CHANGE_START',
      gameCode: gameCode,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(gameCode);
    this.sendMessage(subject, messageStr);
  }

  public sendPlayerSeatChangeDone(gameCode: string) {
    const tick = new Date().getTime();

    const messageId = `SEATMOVE:${tick}`;

    const message: any = {
      type: 'PLAYER_SEAT_CHANGE_DONE',
      gameCode: gameCode,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(gameCode);
    this.sendMessage(subject, messageStr);
  }

  public sendReloadApproved(
    gameCode: string,
    playerId: number,
    playerUuid: string,
    playerName: string,
    oldStack: number,
    newStack: number,
    reloadAmount: number
  ) {
    const tick = new Date().getTime();

    const messageId = `RELOADAPPROVED:${tick}`;

    const message: any = {
      type: 'STACK_RELOADED',
      subType: 'APPROVED',
      gameCode: gameCode,
      playerName: playerName,
      playerId: playerId,
      playerUuid: playerUuid,
      requestId: messageId,
      oldStack: centsToChips(oldStack),
      newStack: centsToChips(newStack),
      reloadAmount: centsToChips(reloadAmount),
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(gameCode);
    this.sendMessage(subject, messageStr);
  }

  public sendReloadApprovalRequest(
    game: PokerGame,
    clubName: string,
    requestingPlayer: Player,
    host: Player,
    messageId: string
  ) {
    const message: any = {
      type: 'RELOAD_REQUEST',
      gameCode: game.gameCode,
      gameType: GameType[game.gameType],
      smallBlind: centsToChips(game.smallBlind),
      bigBlind: centsToChips(game.bigBlind),
      clubName: clubName,
      requestingPlayerId: requestingPlayer.id,
      requestingname: requestingPlayer.name,
      requestingPlayerUuid: requestingPlayer.uuid,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getPlayerChannel(host);
    this.sendMessage(subject, messageStr);
  }

  public sendReloadWaitTime(
    game: PokerGame,
    clubName: string,
    requestingPlayer: Player,
    waitTime: number,
    messageId: string
  ) {
    const message: any = {
      type: 'RELOAD_REQUEST_WAIT_FOR_APPROVAL',
      gameCode: game.gameCode,
      requestingPlayerId: requestingPlayer.id,
      requestingname: requestingPlayer.name,
      requestingPlayerUuid: requestingPlayer.uuid,
      waitTime: waitTime,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getPlayerChannel(requestingPlayer);
    this.sendMessage(subject, messageStr);
  }

  public sendReloadTimeout(
    game: PokerGame,
    requestingPlayer: Player,
    messageId: string
  ) {
    const message: any = {
      type: 'RELOAD_TIMEOUT',
      gameCode: game.gameCode,
      requestingPlayerId: requestingPlayer.id,
      requestingname: requestingPlayer.name,
      requestingPlayerUuid: requestingPlayer.uuid,
      requestId: messageId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getPlayerChannel(requestingPlayer);
    this.sendMessage(subject, messageStr);
  }

  public async notifyAppCoinShort(game: PokerGame) {
    const player = await Cache.getPlayer(game.hostUuid);
    const now = new Date();
    now.setSeconds(now.getSeconds() + getAppSettings().coinsAlertNotifyTime);
    const endMins = Math.round(getAppSettings().coinsAlertNotifyTime / 60);
    if (player) {
      const messageId = `APPCOIN:${uuidv4()}`;
      const message: any = {
        type: 'APPCOIN_NEEDED',
        gameCode: game.gameCode,
        requestId: messageId,
        endMins: endMins,
        endTime: now.toISOString(),
      };
      const messageStr = JSON.stringify(message);
      const subject = this.getPlayerChannel(player);
      this.sendMessage(subject, messageStr);
    }
  }

  public async notifyPlayerSwitchSeat(
    game: PokerGame,
    player: Player,
    playerGameInfo: PlayerGameTracker,
    oldSeatNo: number,
    messageId?: string
  ): Promise<void> {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'TABLE_UPDATE',
      subType: NewUpdate[NewUpdate.SWITCH_SEAT],
      gameId: game.id,
      playerId: player.id,
      playerUuid: player.uuid,
      playerName: player.name,
      oldSeatNo: oldSeatNo,
      seatNo: playerGameInfo.seatNo,
      stack: centsToChips(playerGameInfo.stack),
      status: PlayerStatus[playerGameInfo.status],
      buyIn: centsToChips(playerGameInfo.buyIn),
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  public async notifyPlayerSeatReserve(
    game: PokerGame,
    player: Player,
    seatNo: number,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'TABLE_UPDATE',
      subType: TableUpdateReserveSeat,
      gameId: game.id,
      playerId: player.id,
      playerUuid: player.uuid,
      playerName: player.name,
      seatNo: seatNo,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  public newPlayerSat(
    game: PokerGame,
    player: any,
    playerGameInfo: PlayerGameTracker,
    seatNo: number,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'PLAYER_UPDATE',
      gameId: game.id,
      playerId: player.id,
      playerUuid: player.uuid,
      playerName: player.name,
      seatNo: seatNo,
      status: PlayerStatus[playerGameInfo.status],
      stack: centsToChips(playerGameInfo.stack),
      buyIn: centsToChips(playerGameInfo.buyIn),
      gameToken: playerGameInfo.gameToken,
      newUpdate: NewUpdate[NewUpdate.NEW_PLAYER],
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  public async notifyBuyInRequest(
    messageId: string,
    game: PokerGame,
    requestingPlayer: Player,
    host: Player,
    amount: number
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }
    const message = {
      type: 'BUYIN_REQUEST',
      amount: centsToChips(amount).toString(),
      gameCode: game.gameCode,
      playerName: requestingPlayer.name,
      playerUuid: requestingPlayer.uuid,
      hostUuid: host.uuid,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getPlayerChannel(host);
    this.sendMessage(subject, messageStr);

    if (game.clubCode) {
      this.sendClubUpdate(game.clubCode, '', 'BUYIN_REQUEST', messageId, {
        gameCode: game.gameCode,
        hostUuid: host.uuid,
      });
    }
  }

  public playerBuyIn(
    game: PokerGame,
    player: Player,
    playerGameInfo: PlayerGameTracker,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'PLAYER_UPDATE',
      gameId: game.id,
      playerId: player.id,
      playerUuid: player.uuid,
      playerName: player.name,
      seatNo: playerGameInfo.seatNo,
      status: PlayerStatus[playerGameInfo.status],
      stack: centsToChips(playerGameInfo.stack),
      buyIn: centsToChips(playerGameInfo.buyIn),
      newUpdate: NewUpdate[NewUpdate.NEW_BUYIN],
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  public playerKickedOut(
    game: PokerGame,
    player: any,
    seatNo: number,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'PLAYER_UPDATE',
      gameId: game.id,
      playerId: player.id,
      playerUuid: player.uuid,
      playerName: player.name,
      seatNo: seatNo,
      status: PlayerStatus[PlayerStatus.KICKED_OUT],
      newUpdate: NewUpdate[NewUpdate.LEFT_THE_GAME],
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  public hostChanged(
    game: PokerGame,
    newHostPlayer: Player,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'HOST_CHANGED',
      gameId: game.id,
      playerId: newHostPlayer.id,
      playerUuid: newHostPlayer.uuid,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  public playerStatusChanged(
    game: PokerGame,
    player: any,
    oldStatus: PlayerStatus,
    newStatus: NewUpdate,
    stack: number,
    seatNo: number,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      requestId: messageId,
      type: 'PLAYER_UPDATE',
      gameId: game.id,
      playerId: player.id,
      playerUuid: player.uuid,
      playerName: player.name,
      seatNo: seatNo,
      stack: centsToChips(stack),
      status: PlayerStatus[oldStatus],
      newUpdate: NewUpdate[newStatus],
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
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
    this.sendMessage(subject, messageStr);
  }

  public playerLeftGame(
    game: PokerGame,
    player: Player,
    seatNo: number,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'PLAYER_UPDATE',
      gameId: game.id,
      playerId: player.id,
      playerUuid: player.uuid,
      playerName: player.name,
      seatNo: seatNo,
      status: PlayerStatus[PlayerStatus.LEFT],
      newUpdate: NewUpdate[NewUpdate.LEFT_THE_GAME],
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  public async changeGameStatus(
    game: PokerGame,
    status: GameStatus,
    tableStatus: TableStatus,
    forced?: boolean,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'GAME_STATUS',
      gameId: game.id,
      gameStatus: GameStatus[status],
      tableStatus: TableStatus[tableStatus],
      forced: forced,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  public gameSettingsChanged(
    game: PokerGame,
    nextHandBombPot?: boolean,
    messageId?: string
  ) {
    if (this.client === null) {
      return;
    }

    if (!messageId) {
      messageId = uuidv4();
    }

    const message: any = {
      type: 'GAME_SETTINGS_CHANGED',
      gameId: game.id,
      gameCode: game.gameCode,
    };
    if (nextHandBombPot !== undefined) {
      message.nextHandBombPot = nextHandBombPot;
    }
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  // indicate the players that host has started to make seat change
  public async hostSeatChangeProcessStarted(
    game: PokerGame,
    seatChangeHostId: number,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'TABLE_UPDATE',
      subType: Constants.TableHostSeatChangeProcessStart,
      gameId: game.id,
      seatChangeHostId: seatChangeHostId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  // indicate the players that host has ended the seat change
  public async hostSeatChangeProcessEnded(
    game: PokerGame,
    seatUpdates: Array<SeatUpdate>,
    seatChangeHostId: number,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const seatUpdatesArray = new Array<any>();
    for (const update of seatUpdates) {
      const seatUpdatesAny = update as any;
      if (update.status) {
        seatUpdatesAny.status = PlayerStatus[update.status];
        if (update.stack) {
          seatUpdatesAny.stack = centsToChips(update.stack);
        }
      }
      seatUpdatesArray.push(seatUpdatesAny);
    }

    const message = {
      type: 'TABLE_UPDATE',
      subType: Constants.TableHostSeatChangeProcessEnd,
      gameId: game.id,
      seatUpdates: seatUpdatesArray,
      seatChangeHostId: seatChangeHostId,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  // indicate the players that host has ended the seat change
  public async hostSeatChangeSeatMove(
    game: PokerGame,
    updates: Array<SeatMove>,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }
    const seatMoveArray = new Array<any>();
    for (const update of updates) {
      const seatMoveAny = update as any;
      seatMoveAny.stack = centsToChips(update.stack);
      seatMoveArray.push(seatMoveAny);
    }
    const message = {
      type: 'TABLE_UPDATE',
      subType: Constants.TableHostSeatChangeMove,
      gameId: game.id,
      seatMoves: seatMoveArray,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  public playerJoinedTournament(
    tournamentId: number,
    gameCode: string,
    tableNo: number,
    player: Player,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'PLAYER_JOINED',
      tournamentId: tournamentId,
      playerId: player.id,
      playerUuid: player.uuid,
      playerName: player.name,
      tableNo: tableNo,
      gameCode: gameCode,
    };
    const messageStr = JSON.stringify(message);
    const subject = TournamentRepository.getTournamentChannel(tournamentId);
    this.sendMessage(subject, messageStr);
  }

  public tournamentStarted(tournamentId: number, messageId?: string) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'TOURNAMENT_STARTED',
      tournamentId: tournamentId,
    };
    const messageStr = JSON.stringify(message);
    const subject = TournamentRepository.getTournamentChannel(tournamentId);
    this.sendMessage(subject, messageStr);
  }

  public tournamentAboutToStart(tournamentId: number, messageId?: string) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'TOURNAMENT_ABOUT_TO_START',
      tournamentId: tournamentId,
    };
    const messageStr = JSON.stringify(message);
    const subject = TournamentRepository.getTournamentChannel(tournamentId);
    this.sendMessage(subject, messageStr);
  }

  public tournamentLevelChanged(
    tournamentId: number,
    level: any,
    nextLevel: any,
    levelTime: number,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message: any = {
      type: 'LEVEL_CHANGED',
      tournamentId: tournamentId,
      level: level.level,
      sb: level.smallBlind,
      bb: level.bigBlind,
      ante: level.ante,
    };

    if (nextLevel) {
      message.nextLevel = nextLevel.level;
      message.nextSb = nextLevel.smallBlind;
      message.nextBb = nextLevel.bigBlind;
      message.nextAnte = nextLevel.ante;
      message.nextLevelTime = levelTime;
    }

    const messageStr = JSON.stringify(message);
    const subject = TournamentRepository.getTournamentChannel(tournamentId);
    this.sendMessage(subject, messageStr);
  }

  public tournamentUpdate(
    tournamentId: number,
    data: TournamentData,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message: any = {
      type: 'TOURNAMENT_UPDATE',
      tournamentId: tournamentId,
      registeredPlayersCount: data.registeredPlayers.length,
      playersCount: data.playersInTournament.length,
      startTime: data.startTime?.toISOString(),
      status: TournamentStatus[data.status],
    };
    const messageStr = JSON.stringify(message);
    const subject = TournamentRepository.getTournamentChannel(tournamentId);
    this.sendMessage(subject, messageStr);
  }

  public tournamentSetPlayerTable(
    tournamentId: number,
    playerId: number,
    playerUuid: string,
    tableNo: number,
    seatNo: number,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'TOURNAMENT_INITIAL_PLAYER_TABLE',
      tournamentId: tournamentId,
      playerId: playerId,
      playerUuid: playerUuid,
      tableNo: tableNo,
      seatNo: seatNo,
    };
    const messageStr = JSON.stringify(message);
    const subject = TournamentRepository.getTournamentChannel(tournamentId);
    this.sendMessage(subject, messageStr);
  }

  tournamentPlayerMoved(
    tournamentId: number,
    oldTableNo: number,
    oldSeatNo: number,
    newTableNo: number,
    playerId: number,
    playerName: string,
    playerUuid: string,
    stack: number,
    seatNo: number,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }

    const message = {
      type: 'TOURNAMENT_PLAYER_MOVED_TABLE',
      tournamentId: tournamentId,
      playerId: playerId,
      oldTableNo: oldTableNo,
      oldSeatNo: oldSeatNo,
      playerUuid: playerUuid,
      newTableNo: newTableNo,
      playerName: playerName,
      stack: stack,
      seatNo: seatNo,
    };
    const messageStr = JSON.stringify(message);
    const subject = TournamentRepository.getTournamentChannel(tournamentId);
    this.sendMessage(subject, messageStr);
  }

  public async initiateSeatChangeProcess(
    game: PokerGame,
    seatNo: number,
    timeRemaining: number,
    seatChangePlayers: Array<number>,
    seatChangeSeatNos: Array<number>,
    messageId?: string
  ) {
    if (!messageId) {
      messageId = uuidv4();
    }
    const message = {
      type: Constants.TableSeatChangeProcess,
      gameId: game.id,
      seatNo: seatNo,
      seatChangeRemainingTime: timeRemaining,
      seatChangePlayers: seatChangePlayers,
      seatChangeSeatNos: seatChangeSeatNos,
    };
    const messageStr = JSON.stringify(message);
    const subject = this.getGameChannel(game.gameCode);
    this.sendMessage(subject, messageStr);
  }

  public getPlayerChannel(player: Player): string {
    const subject = `player.${player.id}`;
    return subject;
  }

  public getPlayerChannelUsingId(playerId: number): string {
    const subject = `player.${playerId}`;
    return subject;
  }

  public getClubChannel(clubCode: string): string {
    const subject = `club.${clubCode}`;
    return subject;
  }

  public getGameChannel(gameCode: string): string {
    const subject = `game.${gameCode}.player`;
    return subject;
  }

  public getPlayerToHandChannel(gameCode: string): string {
    return `player.${gameCode}.hand`;
  }

  public getHandToAllChannel(gameCode: string): string {
    // broadcast channel
    //"hand.cgweebfa.player.all"
    return `hand.${gameCode}.player.all`;
  }

  public getPlayerHandChannel(gameCode: string, playerId: number): string {
    //"hand.cgweebfa.player.694"
    return `hand.${gameCode}.player.${playerId}`;
  }

  public getPlayerHandTextChannel(gameCode: string, playerId: number): string {
    //"hand.cgweebfa.player.694"
    return `hand.${gameCode}.player.${playerId}.text`;
  }

  public getChatChannel(gameCode: string): string {
    return `game.${gameCode}.chat`;
  }

  public getClientAliveChannel(gameCode: string): string {
    return `clientalive.${gameCode}`;
  }

  public getTournamentChannel(tournamentId: number): string {
    return `tournament.${tournamentId}`;
  }
}

const Nats = new NatsClass();
export {Nats};
