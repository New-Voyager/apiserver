import {
  gameLogPrefix,
  PokerGame,
  PokerGameSettings,
  PokerGameUpdates,
} from '@src/entity/game/game';
import {getGameManager} from '.';
import {Cache} from '@src/cache/index';
import {
  BombPotInterval,
  GameType,
  PlayerStatus,
  TableStatus,
} from '@src/entity/types';
import {GameRepository} from './game';
import {errToStr, getLogger} from '@src/utils/log';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {markDealerChoiceNextHand} from './pendingupdates';
import {NewHandInfo, PlayerInSeat} from './types';
import {GameSettingsRepository} from './gamesettings';
import {PlayersInGameRepository} from './playersingame';
import {GameUpdatesRepository} from './gameupdates';
import {EntityManager} from 'typeorm';
import _ from 'lodash';
import {GameNotFoundError} from '@src/errors';
import {HighRankStats} from '@src/types';

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
  private passedOrbit: boolean;
  private headsup: boolean;
  private activePlayersCount: number;

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
    this.passedOrbit = false;
    this.playersInSeats = {};
    this.postedBlinds = new Array<number>();
    this.headsup = false;
    this.activePlayersCount = 0;
  }

  public getGameCode(): string {
    return this.game.gameCode;
  }

  public getHandNum(): number {
    return this.handNum;
  }

  public async move() {
    const game = await Cache.getGame(this.game.gameCode, false);
    if (!game) {
      throw new GameNotFoundError(this.game.gameCode);
    }
    this.gameSettings = await Cache.getGameSettings(game.gameCode);
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
    logger.debug(
      `[${gameLogPrefix(game)}] Moving to next hand ${this.handNum}`
    );

    this.nextGameType = this.gameUpdate.gameType;

    if (this.gameUpdate.handNum > this.handNum) {
      // API server has already moved to the next hand and is ahead of the game server.
      // Perhaps game server crashed after already having called this endpoint and is recovering now.
      // Don't do anything in that case.
      logger.warn(
        `MoveToNextHand.move is no-op for game ${this.game?.gameCode} because API server hand num (${this.gameUpdate?.handNum}) is ahead of game server (${this.handNum})`
      );
      this.handNum = this.gameUpdate.handNum;
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

        const playerGameRepo =
          transactionEntityManager.getRepository(PlayerGameTracker);
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
        // how many active players in the game
        let activePlayers = 0;
        for (const occupiedSeat of occupiedSeats) {
          if (occupiedSeat) {
            activePlayers++;
          }
        }
        this.activePlayersCount = activePlayers;
        this.headsup = false;
        let headsup = false;
        if (activePlayers == 2) {
          // headsup
          headsup = true;
          this.headsup = true;
        }
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
          lastBombPotHandNum: this.gameUpdate.lastBombPotHandNum,
          calculateButtonPos: true, // calculate button position for next hand
        };
        if (this.bombPotThisHand) {
          setProps['lastBombPotTime'] = new Date();
        }
        const gameUpdatesRepo =
          transactionEntityManager.getRepository(PokerGameUpdates);
        // update button pos and gameType
        await gameUpdatesRepo
          .createQueryBuilder()
          .update()
          .set(setProps)
          .where({
            gameCode: game.gameCode,
          })
          .execute();

        // reset this one-time flag
        if (this.gameSettings) {
          if (this.gameSettings.nextHandBombPot === true) {
            this.gameSettings.nextHandBombPot = false;

            const settings = await Cache.getGameSettings(game.gameCode);
            let gameType = GameType.UNKNOWN;
            if (settings.bombPotGameType !== GameType.UNKNOWN) {
              gameType = settings.bombPotGameType;
            }
            if (settings.bombPotGameType === GameType.UNKNOWN) {
              gameType = game.gameType;
            }
            await Cache.updateNextHandBombPot(game.gameCode, false, gameType);
            const setProps: any = {
              bombPotGameType: gameType,
            };
            // update game type
            await gameUpdatesRepo
              .createQueryBuilder()
              .update()
              .set(setProps)
              .where({
                gameCode: game.gameCode,
              })
              .execute();
          }
        }

        if (game.gameType === GameType.DEALER_CHOICE) {
          let promptChoice = false;
          if (!this.gameUpdate.dealerChoiceOrbit) {
            promptChoice = true;
          } else {
            if (this.passedOrbit) {
              promptChoice = true;
            }
          }

          if (promptChoice) {
            // if the game is dealer's choice, then prompt the user for next hand
            await markDealerChoiceNextHand(game, transactionEntityManager);
          }
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
        } status: ${PlayerStatus[player.status]} missedBlind: ${
          player.missedBlind
        } postedBlind: ${player.postedBlind}`
      );
    }

    this.gameUpdate = await GameUpdatesRepository.get(this.game.gameCode, true);
    logger.debug(
      `[${gameLogPrefix(game)}] Hand Num: ${this.gameUpdate.handNum} Button: ${
        this.gameUpdate.buttonPos
      } SB: ${this.gameUpdate.sbPos} BB: ${this.gameUpdate.bbPos}`
    );
  }

  private async updateThisHand(
    occupiedSeats: Array<number>,
    entityManager: EntityManager
  ) {
    // update the players who have posted blinds or posted due to natural blind position
    const playerGameTrackerRepo =
      entityManager.getRepository(PlayerGameTracker);

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
        let inHandNextHand = true;
        // if the player has less than ante, don't include the player
        if (player.stack <= this.game.ante) {
          inHandNextHand = false;
        }

        // this player is in the hand
        await playerGameTrackerRepo.update(
          {
            game: {id: this.game.id},
            playerId: player.playerId,
          },
          {
            inHandNextHand: inHandNextHand,
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
    let orbitPos = this.gameUpdate.orbitPos;
    let buttonPos = this.gameUpdate.buttonPos;

    if (this.gameUpdate.calculateButtonPos) {
      if (this.handNum === 1) {
        buttonPos = 1;
      } else {
        const oldButtonPos = buttonPos;
        buttonPos = this.gameUpdate.sbPos;

        if (this.headsup) {
          /*
            1:btn  2:sb  3:bb
            1 - busted
            2:bb 3:btn sb   (bb->btn/sb)

            1:btn  2:sb  3:bb
            2 busted
            3:sb btn 1:bb (bb->btn/sb)

            # last big blind was busted, find the previous active player and set it as the button
          */
          // last hand's bigblind will be the button
          buttonPos = this.gameUpdate.bbPos;
          // if last big blind wa
          if (!takenSeats[buttonPos]) {
            // last big blind was busted, find the previous active player and set it as the button
            for (let seatNo = 1; seatNo <= this.game.maxPlayers; seatNo++) {
              buttonPos--;
              if (buttonPos == 0) {
                buttonPos = this.game.maxPlayers;
              }
              const playerSeat = takenSeats[seatNo];
              if (playerSeat && playerSeat.status === PlayerStatus.PLAYING) {
                break;
              }
            }
          }
        }

        // if old button position 7, 8, 9 and now it is 2
        // then we passed seat no 1
        // this should be called ROE position
        if (oldButtonPos > buttonPos) {
          this.buttonPassedDealer = true;
        }

        // orbit pos 1
        // old button pos 1
        // then we passed the orbit
        if (this.handNum > 1 && this.handNum > this.gameUpdate.orbitHandNum) {
          if (buttonPos === orbitPos) {
            this.passedOrbit = true;
          } else {
            if (buttonPos < oldButtonPos) {
              // oldButtonPos: 9
              // newButtonPos: 2
              // orbitPos: 1 (player left)
              if (orbitPos <= buttonPos) {
                this.passedOrbit = true;
              }
            }
          }
        }
        if (this.game.gameType === GameType.DEALER_CHOICE) {
          logger.debug(
            `[${gameLogPrefix(
              this.game
            )}] DealerChoice: buttonPos: ${buttonPos} oldButtonPos: ${oldButtonPos} orbitPos: ${orbitPos} passedOrbit: ${
              this.passedOrbit
            }`
          );
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
    if (this.headsup) {
      sbPos = this.buttonPos;
    } else {
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
      if (this.handNum === 1 && this.gameUpdate.gameType === GameType.UNKNOWN) {
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
    if (this.gameSettings.nextHandBombPot === true) {
      this.bombPotThisHand = true;
    } else {
      if (!this.gameSettings.bombPotEnabled) {
        return;
      }
      if (this.handNum === 1) {
        // Should not run bomb pot on the first hand.
        // this.bombPotThisHand = true;
        this.gameUpdate.lastBombPotTime = new Date();
        this.gameUpdate.lastBombPotHandNum = 0;
      } else {
        if (
          this.gameSettings.bombPotIntervalType == BombPotInterval.TIME_INTERVAL
        ) {
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
            this.gameUpdate.lastBombPotHandNum = this.gameUpdate.handNum + 1;
            this.bombPotThisHand = true;
          }
        } else if (
          this.gameSettings.bombPotIntervalType == BombPotInterval.EVERY_X_HANDS
        ) {
          // every x hands
          const handDiff =
            this.gameUpdate.handNum + 1 - this.gameUpdate.lastBombPotHandNum;
          if (handDiff >= this.gameSettings.bombPotHandInterval) {
            // time to run a bomb pot
            logger.debug(
              `Game: ${this.game.gameCode} Time for next bomb pot. Hand num: ${this.gameUpdate.handNum}`
            );
            this.gameUpdate.lastBombPotHandNum = this.gameUpdate.handNum + 1;
            this.bombPotThisHand = true;
          }
        }
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
    if (!game) {
      throw new GameNotFoundError(this.gameCode);
    }

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
        const game = await Cache.getGame(
          this.gameCode,
          false,
          transactionEntityManager
        );

        if (!game) {
          throw new GameNotFoundError(this.gameCode);
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

        const playersInSeats: Array<PlayerGameTracker> =
          await PlayersInGameRepository.getPlayersInSeats(
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
          buttonStraddleBet: 0,
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
              buttonStraddleBet: 0,
            });
          } else {
            const player = await Cache.getPlayer(playerSeat.playerUuid);
            if (!player) {
              throw new Error(
                `Could not find Player object for uuid ${playerSeat.playerUuid}`
              );
            }

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
              encryptionKey: player.encryptionKey,

              // player settings
              runItTwice: runItTwiceEnabled,
              autoStraddle: playerSeat.autoStraddle,
              muckLosingHand: playerSeat.muckLosingHand,
              buttonStraddle: playerSeat.buttonStraddle,
              buttonStraddleBet: playerSeat.buttonStraddleBet,
            });
          }
        }

        let gameType = gameUpdate.gameType;
        let announceGameType = false;
        if (game.gameType === GameType.ROE) {
          if (gameUpdate.gameType !== gameUpdate.prevGameType) {
            announceGameType = true;
          }
        }
        if (game.gameType === GameType.DEALER_CHOICE) {
          // dealer choice is announced via game message
          announceGameType = false;
        }
        let doubleBoard = gameSettings.doubleBoardEveryHand;
        if (gameUpdate.bombPotThisHand) {
          doubleBoard = gameSettings.doubleBoardBombPot;
          if (gameUpdate.bombPotGameType) {
            gameType = gameUpdate.bombPotGameType;
            announceGameType = true;
          }
        }

        if (game.gameType === GameType.DEALER_CHOICE) {
          doubleBoard = gameUpdate.doubleBoard;
        }

        logger.info(
          `[${gameLogPrefix(game)}] Next Hand:HandNum: ${
            gameUpdate.handNum
          } SB: ${gameUpdate.sbPos} BB: ${gameUpdate.bbPos} Button: ${
            gameUpdate.buttonPos
          }`
        );
        let highRankStats: HighRankStats = {
          totalHands: 0,
          straightFlush: 0,
          fourKind: 0,
          lastSFHand: 0,
          last4kHand: 0,
        };

        try {
          highRankStats = await Cache.getHighRankStats(game);
        } catch (err) {
          // not a critical error
          logger.warn(
            `Could not get high rank stats from cache: ${errToStr(err)}`
          );
        }

        const isSFAllowed = shouldAllowStraightFlush(
          gameType,
          highRankStats.totalHands,
          highRankStats.lastSFHand
        );
        const is4kAllowed = shouldAllow4K(
          gameType,
          highRankStats.totalHands,
          highRankStats.last4kHand
        );

        if (!isSFAllowed || !is4kAllowed) {
          logger.info(
            `SF allowed?: ${isSFAllowed}, 4K allowed?: ${is4kAllowed} Total Hands: ${highRankStats.totalHands}, Last SF: ${highRankStats.lastSFHand}, Last 4K: ${highRankStats.last4kHand}`
          );
        }

        const nextHandInfo: NewHandInfo = {
          gameId: game.id,
          gameCode: this.gameCode,
          gameType: gameType,
          announceGameType: announceGameType,
          playersInSeats: seats,
          smallBlind: game.smallBlind,
          bigBlind: game.bigBlind,
          ante: game.ante,
          maxPlayers: game.maxPlayers,
          buttonPos: gameUpdate.buttonPos,
          handNum: gameUpdate.handNum,
          actionTime: game.actionTime,
          straddleBet: game.straddleBet,
          chipUnit: game.chipUnit,
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
          highHandTracked: game.highHandTracked,
          highHandRank: game.highHandRank,
          // Not implemented yet (do we need it?)
          bringIn: 0,
          totalHands: highRankStats.totalHands,
          straightFlushCount: highRankStats.straightFlush,
          fourKindCount: highRankStats.fourKind,
          straightFlushAllowed: isSFAllowed,
          fourKindAllowed: is4kAllowed,
        };
        return nextHandInfo;
      }
    );
    return ret;
  }
}

/*
  Intervals are based on 3-player hand.
*/
function shouldAllowStraightFlush(
  gameType: GameType,
  totalHands: number,
  lastSFHand: number
): boolean {
  let interval: number;
  switch (gameType) {
    case GameType.HOLDEM:
      interval = 1248; // 1/0.000801
      break;
    case GameType.PLO:
    case GameType.PLO_HILO:
      interval = 419; // 1/(0.000795 * 3)
      break;
    case GameType.FIVE_CARD_PLO:
    case GameType.FIVE_CARD_PLO_HILO:
      interval = 300; // Just a random guess. Can't find the correct value.
      break;
    case GameType.SIX_CARD_PLO:
    case GameType.SIX_CARD_PLO_HILO:
      interval = 200; // Just a random guess. Can't find the correct value.
      break;
    default:
      // Just some arbitrary number to fall back to.
      interval = 200;
      break;
  }

  const multiplier = 0.7;
  return totalHands - lastSFHand > interval * multiplier;
}

/*
  Intervals are based on 3-player hand.
*/
function shouldAllow4K(
  gameType: GameType,
  totalHands: number,
  last4kHand: number
): boolean {
  let interval: number;
  switch (gameType) {
    case GameType.HOLDEM:
      interval = 219; // 1/0.004560
      break;
    case GameType.PLO:
    case GameType.PLO_HILO:
      interval = 69; // 1/(0.0048 * 3)
      break;
    case GameType.FIVE_CARD_PLO:
    case GameType.FIVE_CARD_PLO_HILO:
      interval = 60; // Just a random guess. Can't find the correct value.
      break;
    case GameType.SIX_CARD_PLO:
    case GameType.SIX_CARD_PLO_HILO:
      interval = 50; // Just a random guess. Can't find the correct value.
      break;
    default:
      // Just some arbitrary number to fall back to.
      interval = 50;
      break;
  }

  const multiplier = 0.7;
  return totalHands - last4kHand > interval * multiplier;
}
