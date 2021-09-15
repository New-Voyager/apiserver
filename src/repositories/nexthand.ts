import {
  PokerGame,
  PokerGameSettings,
  PokerGameUpdates,
} from '@src/entity/game/game';
import {getGameManager} from '.';
import {Cache} from '@src/cache/index';
import {GameType, PlayerStatus, TableStatus} from '@src/entity/types';
import {GameRepository} from './game';
import {getLogger} from '@src/utils/log';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {markDealerChoiceNextHand} from './pendingupdates';
import {NewHandInfo, PlayerInSeat} from './types';
import {GameSettingsRepository} from './gamesettings';
import {PlayersInGameRepository} from './playersingame';
import {GameUpdatesRepository} from './gameupdates';
import {EntityManager} from 'typeorm';
import _ from 'lodash';

const logger = getLogger('repositories::nexthand');

// we use the players sitting in the previous hand to determine the button position and small blind position and big blind position
// Let us use examples to describe different scenarios
// Prev Hand Players: [D, 1, 2, 3, 4], buttonPos: 1
// * Seat 2 leaves in this hand
// The new button position 2, and it is dead button
// Prev Hand Players: [D, 1, 0, 3, 4], buttonPos: 1
// * A new player joins in seat 2
// the new button positions is seat 3
// D: 0 index is a dealer seat (just a filler)

// Small blind
// Prev Hand Players: [D, 1, 2, 3, 4], buttonPos: 1, sb: 2, bb: 3
// * Seat 3 leaves in this hand
// The new button position is 2, 3: dead small, 4: bb
// next hand
// button position: 3 dead button, 4: sb, 1: bb

// missed blinds scenarios
// 1. player missed blind did not post blind (not natural bb)
//   >> exclude the player
// 2. player missed blind, posted blind
//   >> include the player
// 3. player missed blind, natural blind
//   >> include the player
// 4. player missed blind, did not post blind, but on a button position
//   >> exclude the player (dead button)
// 5. player missed blind, posted blind, on a button position
//   >> include the player
// 6. player missed blind, did not post the blind, on a small blind position
//   >> exclude the player
// 7. player missed blind, posted blind, on a small blind position
//   >> include the player

// store these values
// last_button_pos, last_sb_pos, last_bb_pos
// last_button_pos_player_id, last_sb_pos_player_id, last_bb_pos_player_id

// calculating next button
// button pos: last small blind position
// if button pos player id != last_sb_pos_player_id
//      dead button = true
//      did this player post blind?
//          dead button = false;

// calculating small blind pos
// small blind: last_bb_pos
// if small pos player id != last_bb_pos_player_id
//    dead small = true
//      did this player post blind?
//          dead small = false;

class MoveToNextHand {
  private game: PokerGame;
  private handNum: number;
  private buttonPos: number;
  private bbPos: number;
  private sbPos: number;
  private gameSettings: PokerGameSettings | null;
  private gameUpdate: PokerGameUpdates | null;
  private buttonPassedDealer: boolean;
  private nextGameType: GameType;
  private playersInSeats: {[key: number]: PlayerGameTracker | null};
  private playersInThisHand: {[key: number]: PlayerGameTracker | null};
  private bombPotThisHand: boolean;
  private missedBlinds: Array<number>;
  private postedBlinds: Array<number>;

  constructor(game: PokerGame, handNum: number) {
    this.game = game;
    this.handNum = handNum;
    this.buttonPos = 0;
    this.sbPos = 0;
    this.bbPos = 0;
    this.gameSettings = null;
    this.gameUpdate = null;
    this.buttonPassedDealer = false;
    this.nextGameType = GameType.UNKNOWN;
    this.playersInThisHand = {};
    this.missedBlinds = new Array<number>();
    this.bombPotThisHand = false;
    this.playersInSeats = {};
    this.postedBlinds = new Array<number>();
  }

  public getGameCode(): string {
    return this.game.gameCode;
  }

  public getHandNum(): number {
    return this.handNum;
  }

  public async move() {
    const game: PokerGame = await Cache.getGame(this.game.gameCode, false);
    if (!game) {
      throw new Error(`Game code: ${this.game.gameCode} not found`);
    }
    this.gameSettings = await GameSettingsRepository.get(game.gameCode);
    if (!this.gameSettings) {
      throw new Error(
        `Game ${this.game.gameCode} is not found in PokerGameSettings`
      );
    }

    this.gameUpdate = await GameUpdatesRepository.get(game.gameCode);
    if (!this.gameUpdate) {
      throw new Error(
        `Game ${this.game.gameCode} is not found in PokerGameSettings`
      );
    }

    this.nextGameType = this.gameUpdate.gameType;

    if (this.gameUpdate.handNum > this.handNum) {
      // API server has already moved to the next hand and is ahead of the game server.
      // Perhaps game server crashed after already having called this endpoint and is recovering now.
      // Don't do anything in that case.
      return;
    }
    this.handNum++;
    const ret = await getGameManager().transaction(
      async transactionEntityManager => {
        if (!this.gameUpdate) {
          throw new Error(`Game code: ${this.game.gameCode} not found`);
        }

        let playersInSeats = await PlayersInGameRepository.getPlayersInSeats(
          game.id,
          transactionEntityManager
        );

        const playerGameRepo = transactionEntityManager.getRepository(
          PlayerGameTracker
        );
        // reset posted blind next field
        await playerGameRepo.update(
          {
            game: {id: this.game.id},
          },
          {
            postedBlindNextHand: false,
            inHandNextHand: false,
          }
        );

        playersInSeats = await PlayersInGameRepository.getPlayersInSeats(
          game.id,
          transactionEntityManager
        );

        this.playersInSeats = playersInSeats;

        let playerInSeatsInPrevHand: Array<number> = [];
        if (this.gameUpdate && this.gameUpdate.playersInLastHand !== null) {
          playerInSeatsInPrevHand = JSON.parse(
            this.gameUpdate.playersInLastHand
          );
        }

        const takenSeats: _.Dictionary<PlayerGameTracker> = _.keyBy(
          playersInSeats,
          'seatNo'
        );
        const occupiedSeats = this.getOccupiedSeats(takenSeats);

        logger.debug(
          `MoveToNextHand.move Previous hand: [${playerInSeatsInPrevHand.toString()}] Current hand: [${occupiedSeats.toString()}]`
        );
        // determine button position
        this.determineButtonPos(playerInSeatsInPrevHand, takenSeats);

        // determine blind positions
        this.missedBlinds = this.determineBlindPos(takenSeats, occupiedSeats);

        this.determineBombPotThisHand();

        // update players for the current hand
        await this.updateThisHand(occupiedSeats, transactionEntityManager);

        // determine next game type
        await this.determineNextGameType();

        const setProps: any = {
          gameType: this.nextGameType,
          prevGameType: this.gameUpdate.gameType,
          buttonPos: this.buttonPos,
          sbPos: this.sbPos,
          bbPos: this.bbPos,
          handNum: this.handNum,
          bombPotThisHand: this.bombPotThisHand,
          calculateButtonPos: true, // calculate button position for next hand
        };
        if (this.bombPotThisHand) {
          setProps['lastBombPotTime'] = new Date();
        }
        const gameUpdatesRepo = transactionEntityManager.getRepository(
          PokerGameUpdates
        );
        // update button pos and gameType
        await gameUpdatesRepo
          .createQueryBuilder()
          .update()
          .set(setProps)
          .where({
            gameCode: game.gameCode,
          })
          .execute();

        if (game.gameType === GameType.DEALER_CHOICE) {
          // if the game is dealer's choice, then prompt the user for next hand
          await markDealerChoiceNextHand(game, transactionEntityManager);
        }

        if (this.gameUpdate && this.gameUpdate.gameType !== this.nextGameType) {
          // announce the new game type
          logger.debug(
            `Game type is changed. New game type: ${this.gameUpdate.gameType}`
          );
        }
        return;
      }
    );
    const playerInSeats = await PlayersInGameRepository.getPlayersInSeats(
      this.game.id
    );
    for (const player of playerInSeats) {
      logger.debug(
        `Seat: ${player.seatNo} Player: ${player.playerName} inhand: ${
          player.inHandNextHand
        } status: ${player.status.toString()} missedBlind: ${
          player.missedBlind
        } postedBlind: ${player.postedBlind}`
      );
    }

    this.gameUpdate = await GameUpdatesRepository.get(this.game.gameCode, true);
    logger.info(
      `Game: ${this.game.gameCode} Hand Num: ${this.gameUpdate.handNum} Button: ${this.gameUpdate.buttonPos} SB: ${this.gameUpdate.sbPos} BB: ${this.gameUpdate.bbPos}`
    );
  }

  private async updateThisHand(
    occupiedSeats: Array<number>,
    entityManager: EntityManager
  ) {
    // update the players who have posted blinds or posted due to natural blind position
    const playerGameTrackerRepo = entityManager.getRepository(
      PlayerGameTracker
    );

    // if only two players are playing, then don't worry about missed blind
    // and a dealer seat
    if (occupiedSeats.length > 3) {
      if (this.missedBlinds.length > 0) {
        logger.info(`Players missed blinds: ${this.missedBlinds.toString()}`);
        for (const seatNo of this.missedBlinds) {
          await playerGameTrackerRepo.update(
            {
              game: {id: this.game.id},
              seatNo: seatNo,
            },
            {
              missedBlind: true,
            }
          );
        }
      } else {
      }
    }

    for (const seatNo of this.postedBlinds) {
      await playerGameTrackerRepo.update(
        {
          game: this.game,
          seatNo: seatNo,
        },
        {
          missedBlind: false,
          postedBlind: false,
          postedBlindNextHand: true,
        }
      );
    }

    // update the players who are in this hand
    for (const player of Object.values(this.playersInThisHand)) {
      if (player) {
        // this player is in the hand
        await playerGameTrackerRepo.update(
          {
            game: {id: this.game.id},
            playerId: player.playerId,
          },
          {
            inHandNextHand: true,
          }
        );

        if (player.postedBlind) {
          await playerGameTrackerRepo.update(
            {
              game: this.game,
              seatNo: player.seatNo,
            },
            {
              missedBlind: false,
              postedBlind: false,
              postedBlindNextHand: true,
            }
          );
        }
      }
    }
  }

  private getOccupiedSeats(
    takenSeats: _.Dictionary<PlayerGameTracker>
  ): Array<number> {
    // occupied seats contain list of player ids in the table if the player is playing
    const occupiedSeats = new Array<number>();
    occupiedSeats.push(0);
    for (let seatNo = 1; seatNo <= this.game.maxPlayers; seatNo++) {
      const playerSeat = takenSeats[seatNo];

      if (!playerSeat) {
        occupiedSeats.push(0);
      } else {
        if (playerSeat.status === PlayerStatus.PLAYING) {
          occupiedSeats.push(playerSeat.playerId);
          if (playerSeat.missedBlind && !playerSeat.postedBlind) {
            // this player cannot play
            this.playersInThisHand[playerSeat.seatNo] = null;
          } else {
            // this player is in this hand
            this.playersInThisHand[playerSeat.seatNo] = playerSeat;
          }
        } else {
          occupiedSeats.push(0);
        }
      }
    }
    return occupiedSeats;
  }

  private determineButtonPos(
    playerInSeatsInPrevHand: Array<number>,
    takenSeats: _.Dictionary<PlayerGameTracker>
  ) {
    if (!this.gameUpdate) {
      throw new Error(`Game code: ${this.game.gameCode} not found`);
    }
    if (!this.game) {
      throw new Error(`Game code: ${this.gameUpdate.gameCode} not found`);
    }

    // calculating next button
    // button pos: last small blind position
    // if button pos player id != last_sb_pos_player_id
    //      dead button = true
    //      did this player post blind?
    //          dead button = false;

    let buttonPos = this.gameUpdate.buttonPos;
    if (this.gameUpdate.calculateButtonPos) {
      if (this.handNum === 1) {
        buttonPos = 1;
      } else {
        const oldButtonPos = buttonPos;
        buttonPos = this.gameUpdate.sbPos;
        if (oldButtonPos > buttonPos) {
          this.buttonPassedDealer = true;
        }
        const playerSeat = takenSeats[buttonPos];
        if (playerSeat) {
          if (playerSeat.missedBlind && !playerSeat.postedBlind) {
            // scenario 4: player missed blind, had not posted blind, on a button position
            // player is not in this hand
            // dead button
            this.playersInThisHand[buttonPos] = null;
          }
        }
      }
    }
    this.buttonPos = buttonPos;
  }

  private determineBlindPos(
    takenSeats: _.Dictionary<PlayerGameTracker>,
    occupiedSeats: Array<number>
  ): Array<number> {
    if (!this.gameUpdate) {
      throw new Error(`Game code: ${this.game.gameCode} not found`);
    }
    // seat numbers that missed the blinds
    const missedBlinds = new Array<number>();
    let sbPos = this.gameUpdate.bbPos;
    if (this.handNum === 1 || !this.gameUpdate.calculateButtonPos) {
      let maxPlayers = this.game.maxPlayers;
      sbPos = this.buttonPos;
      while (maxPlayers > 0) {
        sbPos++;
        if (sbPos > this.game.maxPlayers) {
          sbPos = 1;
        }

        if (occupiedSeats[sbPos] !== 0) {
          break;
        }
        maxPlayers--;
      }
    } else {
      const playerSeat = takenSeats[sbPos];
      if (playerSeat) {
        if (playerSeat.missedBlind && !playerSeat.postedBlind) {
          // dead small
          this.playersInThisHand[sbPos] = null;
        }
      }
    }

    let bbPos = sbPos;
    let maxPlayers = this.game.maxPlayers;
    while (maxPlayers > 0) {
      bbPos++;
      if (bbPos > this.game.maxPlayers) {
        bbPos = 1;
      }

      if (takenSeats[bbPos]) {
        const takenSeat = takenSeats[bbPos];

        // this player is in break and missed the blind
        if (
          takenSeat.status === PlayerStatus.IN_BREAK ||
          takenSeat.status === PlayerStatus.WAIT_FOR_BUYIN ||
          takenSeat.status === PlayerStatus.WAIT_FOR_BUYIN_APPROVAL
        ) {
          missedBlinds.push(bbPos);
        }
      }

      if (occupiedSeats[bbPos] !== 0) {
        // big blind player is always in the hand
        this.playersInThisHand[bbPos] = takenSeats[bbPos];
        this.postedBlinds.push(bbPos);
        break;
      }
      maxPlayers--;
    }

    this.sbPos = sbPos;
    this.bbPos = bbPos;
    return missedBlinds;
  }

  private async determineNextGameType() {
    if (!this.gameUpdate) {
      throw new Error(`Game code: ${this.game.gameCode} not found`);
    }
    if (!this.game) {
      throw new Error(`Game code: ${this.gameUpdate.gameCode} not found`);
    }
    const gameSettings = await Cache.getGameSettings(this.game.gameCode);

    // determine new game type (ROE)
    if (this.game.gameType === GameType.ROE) {
      // button passed dealer
      let roeGames = gameSettings.roeGames.split(',');
      if (this.handNum !== 1) {
        if (this.buttonPassedDealer) {
          const gameTypeStr = GameType[this.gameUpdate.gameType];
          let index = roeGames.indexOf(gameTypeStr.toString());
          index++;
          if (index >= roeGames.length) {
            index = 0;
          }
          this.nextGameType = GameType[roeGames[index]];
        }
      } else {
        roeGames = gameSettings.roeGames.split(',');
        this.nextGameType = GameType[roeGames[0]];
      }
    } else if (this.game.gameType === GameType.DEALER_CHOICE) {
      if (this.handNum === 1) {
        const dealerChoiceGames = gameSettings.dealerChoiceGames.split(',');
        this.nextGameType = GameType[dealerChoiceGames[0]];
      }
    } else {
      this.nextGameType = this.game.gameType;
    }
  }

  private determineBombPotThisHand() {
    if (!this.gameUpdate || !this.gameSettings) {
      return;
    }
    this.bombPotThisHand = false;
    if (!this.gameSettings.bombPotEnabled) {
      return;
    }
    if (this.handNum === 1) {
      this.bombPotThisHand = true;
      this.gameUpdate.lastBombPotTime = new Date();
    } else {
      const now = new Date();
      const intervalInMs = this.gameSettings.bombPotInterval * 1000;
      if (this.gameUpdate.lastBombPotTime === null) {
        this.gameUpdate.lastBombPotTime = new Date();
      }
      const nextBombPotTime = new Date(
        this.gameUpdate.lastBombPotTime.getTime() + intervalInMs
      );
      logger.debug(
        `Next bomb time: ${nextBombPotTime.toISOString()} now: ${now.toISOString()}`
      );
      if (
        now.getTime() > nextBombPotTime.getTime() ||
        this.gameSettings.bombPotEveryHand
      ) {
        logger.debug(`Game: ${this.game.gameCode} Time for next bomb pot`);
        this.bombPotThisHand = true;
      }
    }

    if (!this.bombPotThisHand) {
      return;
    }

    logger.debug(`${this.game.gameCode}: ${this.handNum} Bomb pot this hand`);

    const playersInBombPot: {[key: number]: PlayerGameTracker | null} = {};
    const takenSeats = _.keyBy(this.playersInSeats, 'seatNo');

    // if we are doing bomb pot this hand,
    // 1. allow only the players who have more than bomb pot bet
    // 2. if a player opted not to do bomb pot exclude them
    // 3. if less than 2 players opted for bomb pot, then don't do bomb pot
    let minBetAmount = this.game.bigBlind;
    if (this.bombPotThisHand) {
      minBetAmount = this.gameSettings.bombPotBet * this.game.bigBlind;
      let playersWithBombPotStack = 0;
      for (let seatNo = 1; seatNo <= this.game.maxPlayers; seatNo++) {
        const playerSeat = takenSeats[seatNo];
        if (
          playerSeat &&
          playerSeat.status === PlayerStatus.PLAYING &&
          playerSeat.bombPotEnabled
        ) {
          if (playerSeat.stack >= minBetAmount) {
            playersWithBombPotStack++;
            playersInBombPot[playerSeat.seatNo] = playerSeat;
          }
        }
      }

      if (playersWithBombPotStack < 2) {
        // no bomb pots
        this.bombPotThisHand = false;
      } else {
        // players in bomb pot do not need to post blind next hand
        for (const seat of Object.values(playersInBombPot)) {
          if (seat) {
            this.postedBlinds.push(seat.seatNo);
          }
        }

        // exclude the players who are not in for bomp pot
        for (const playerInHand of Object.values(this.playersInThisHand)) {
          if (playerInHand) {
            if (!playersInBombPot[playerInHand.seatNo]) {
              // exclude this player from the hand
              this.playersInThisHand[playerInHand.seatNo] = null;
            }
          }
        }
      }
    }
  }
}

export class NextHandProcess {
  private gameCode: string;
  private gameServerHandNum: number;

  constructor(gameCode: string, gameServerHandNum: number) {
    this.gameCode = gameCode;
    this.gameServerHandNum = gameServerHandNum;
  }

  public async moveToNextHand() {
    const game = await Cache.getGame(this.gameCode);
    const moveToNextHand = new MoveToNextHand(game, this.gameServerHandNum);
    await moveToNextHand.move();
    return {
      gameCode: moveToNextHand.getGameCode(),
      handNum: moveToNextHand.getHandNum(),
      gameStatus: game.status,
      tableStatus: game.tableStatus,
    };
  }

  //
  // WARNING
  //
  //
  // AS THE FUNCTION NAME SUGGESTS, THIS IS A 'GETTER' FUNCTION.
  // WHEN GAME SERVER CALLS THIS FUNCTION MORE THAN ONCE DUE TO A
  // CRASH-RESTART, IT IS IMPORTANT THAT THIS FUNCTION RETURNS THE SAME DATA.
  // WE SHOULD TRY NOT TO HAVE ANY SIDE EFFECTS IN THIS FUNCTION
  // THAT WILL ALTER THE RETURNED DATA IN THE SUBSEQUENT CALLS.
  // USE moveToNextHand FUNCTION INSTEAD FOR ANY MUTATIONS. THAT
  // FUNCTION HAS A GUARD AGAINST EXECUTING MULTIPLE TIMES WHEN
  // CALLED FROM THE GAME SERVER.
  //
  public async getNextHandInfo(): Promise<NewHandInfo> {
    const ret = await getGameManager().transaction(
      async transactionEntityManager => {
        const game: PokerGame = await Cache.getGame(
          this.gameCode,
          false,
          transactionEntityManager
        );
        if (!game) {
          throw new Error(`Game code: ${this.gameCode} not found`);
        }

        const gameSettings = await GameSettingsRepository.get(
          game.gameCode,
          false,
          transactionEntityManager
        );
        if (!gameSettings) {
          throw new Error(
            `Game ${this.gameCode} is not found in PokerGameSettings`
          );
        }

        const gameUpdate = await GameUpdatesRepository.get(
          this.gameCode,
          false,
          transactionEntityManager
        );
        if (!gameUpdate) {
          throw new Error(`Game code: Game updates ${this.gameCode} not found`);
        }

        const playersInSeats = await PlayersInGameRepository.getPlayersInSeats(
          game.id,
          transactionEntityManager
        );
        const takenSeats = _.keyBy(playersInSeats, 'seatNo');
        const seats = new Array<PlayerInSeat>();

        // push dealer seat
        seats.push({
          seatNo: 0,
          openSeat: false,
          inhand: false,
          activeSeat: false,
          status: PlayerStatus.NOT_PLAYING,
          gameToken: '',
          runItTwice: false,
          muckLosingHand: false,
          postedBlind: false,
          missedBlind: false,
          autoStraddle: false,
          buttonStraddle: false,
        });

        for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
          let postedBlind = false;
          let missedBlind = false;
          const playerSeat = takenSeats[seatNo];

          if (!playerSeat) {
            seats.push({
              seatNo: seatNo,
              openSeat: true,
              inhand: false,
              status: PlayerStatus.NOT_PLAYING,
              gameToken: '',
              runItTwice: false,
              muckLosingHand: false,
              activeSeat: false,
              postedBlind: false,
              missedBlind: false,
              autoStraddle: false,
              buttonStraddle: false,
            });
          } else {
            let inhand = false;
            let buyInExpTime = '';
            let breakTimeExp = '';
            if (playerSeat.buyInExpAt) {
              buyInExpTime = playerSeat.buyInExpAt.toISOString();
            }
            if (playerSeat.breakTimeExpAt) {
              breakTimeExp = playerSeat.breakTimeExpAt.toISOString();
            }
            const activeSeat = true;
            missedBlind = playerSeat.missedBlind;
            if (playerSeat.status === PlayerStatus.PLAYING) {
              if (this.gameServerHandNum !== 1) {
                inhand = playerSeat.inHandNextHand;
                postedBlind = playerSeat.postedBlindNextHand;
              }
            }
            let runItTwiceEnabled = gameSettings.runItTwiceAllowed;
            if (runItTwiceEnabled) {
              runItTwiceEnabled = playerSeat.runItTwiceEnabled;
            }
            // player is in a seat
            seats.push({
              seatNo: seatNo,
              openSeat: false,
              inhand: inhand,
              postedBlind: postedBlind,
              missedBlind: missedBlind,
              activeSeat: activeSeat,

              playerId: playerSeat.playerId,
              playerUuid: playerSeat.playerUuid,
              name: playerSeat.playerName,
              stack: playerSeat.stack,
              buyIn: playerSeat.buyIn,
              status: playerSeat.status,
              buyInTimeExpAt: buyInExpTime,
              breakTimeExpAt: breakTimeExp,
              gameToken: '',

              // player settings
              runItTwice: runItTwiceEnabled,
              autoStraddle: playerSeat.autoStraddle,
              muckLosingHand: playerSeat.muckLosingHand,
              buttonStraddle: playerSeat.buttonStraddle,
            });
          }
        }

        let announceGameType = false;
        if (game.gameType === GameType.ROE) {
          if (gameUpdate.gameType !== gameUpdate.prevGameType) {
            announceGameType = true;
          }
        }
        if (game.gameType === GameType.DEALER_CHOICE) {
          announceGameType = true;
        }
        let doubleBoard = gameSettings.doubleBoardEveryHand;
        if (gameUpdate.bombPotThisHand) {
          doubleBoard = gameSettings.doubleBoardBombPot;
        }
        const nextHandInfo: NewHandInfo = {
          gameId: game.id,
          gameCode: this.gameCode,
          gameType: gameUpdate.gameType,
          announceGameType: announceGameType,
          playersInSeats: seats,
          smallBlind: game.smallBlind,
          bigBlind: game.bigBlind,
          maxPlayers: game.maxPlayers,
          buttonPos: gameUpdate.buttonPos,
          handNum: gameUpdate.handNum,
          actionTime: game.actionTime,
          straddleBet: game.straddleBet,
          rakePercentage: game.rakePercentage,
          rakeCap: game.rakeCap,
          gameStatus: game.status,
          tableStatus: game.tableStatus,
          sbPos: gameUpdate.sbPos,
          bbPos: gameUpdate.bbPos,
          resultPauseTime: gameSettings.resultPauseTime * 1000,
          doubleBoard: doubleBoard,
          bombPot: gameUpdate.bombPotThisHand,
          bombPotBet: gameSettings.bombPotBet * game.bigBlind,
          runItTwiceTimeout: gameSettings.runItTwiceTimeout,
          // Not implemented yet (do we need it?)
          bringIn: 0,
        };
        return nextHandInfo;
      }
    );
    return ret;
  }
}
