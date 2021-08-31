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
import _ from 'lodash';
import {GameSettingsRepository} from './gamesettings';

const logger = getLogger('next_hand_process');

export class NextHandProcess {
  private gameCode: string;
  private gameServerHandNum: number;

  constructor(gameCode: string, gameServerHandNum: number) {
    this.gameCode = gameCode;
    this.gameServerHandNum = gameServerHandNum;
  }

  public async moveToNextHand() {
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

        const gameSettings = await GameSettingsRepository.get(game.gameCode);
        if (!gameSettings) {
          throw new Error(
            `Game ${this.gameCode} is not found in PokerGameSettings`
          );
        }

        const gameUpdatesRepo = transactionEntityManager.getRepository(
          PokerGameUpdates
        );
        const gameUpdates = await gameUpdatesRepo.find({
          gameID: game.id,
        });
        if (gameUpdates.length === 0) {
          const res = {error: 'GameUpdates not found'};
          throw new Error(`Game code: ${this.gameCode} not found`);
        }
        const gameUpdate = gameUpdates[0];
        if (gameUpdate.handNum > this.gameServerHandNum) {
          // API server has already moved to the next hand and is ahead of the game server.
          // Perhaps game server crashed after already having called this endpoint and is recovering now.
          // Don't do anything in that case.
          return {
            gameCode: this.gameCode,
            handNum: gameUpdate.handNum,
          };
        }

        let playerInSeatsInPrevHand: Array<number> = [];
        if (gameUpdate.playersInLastHand !== null) {
          playerInSeatsInPrevHand = JSON.parse(gameUpdate.playersInLastHand);
        }

        const playersInSeats = await GameRepository.getPlayersInSeats(
          game.id,
          transactionEntityManager
        );
        const takenSeats = _.keyBy(playersInSeats, 'seatNo');

        for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
          const playerSeat = takenSeats[seatNo];
          if (
            playerSeat &&
            playerSeat['stack'] === 0 &&
            playerSeat['status'] === PlayerStatus.PLAYING
          ) {
            playerSeat['status'] = PlayerStatus.WAIT_FOR_BUYIN;
          }
        }

        const occupiedSeats = new Array<number>();
        // dealer
        occupiedSeats.push(0);
        for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
          const playerSeat = takenSeats[seatNo];

          if (!playerSeat) {
            occupiedSeats.push(0);
          } else {
            if (playerSeat.status === PlayerStatus.PLAYING) {
              occupiedSeats.push(playerSeat.playerId);
            } else {
              occupiedSeats.push(0);
            }
          }
        }

        logger.debug(
          `Previous hand: [${playerInSeatsInPrevHand.toString()}] Current hand: [${occupiedSeats.toString()}]`
        );

        const prevGameType = gameUpdate.gameType;

        // if this is the first hand, then use the currently occupied seats to determine button position
        if (playerInSeatsInPrevHand.length === 0) {
          playerInSeatsInPrevHand = occupiedSeats;
        }

        // seat numbers that missed the blinds
        const missedBlinds = new Array<number>();

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

        let buttonPassedDealer = false;
        let buttonPos = gameUpdate.buttonPos;
        let maxPlayers = game.maxPlayers;
        if (gameUpdate.calculateButtonPos) {
          while (maxPlayers > 0) {
            maxPlayers--;
            buttonPos++;
            if (buttonPos > game.maxPlayers) {
              buttonPassedDealer = true;
              buttonPos = 1;
            }

            // if the button position player had missed the blind and hasn't posted blind
            // then the player cannot be in the hand
            const playerSeat = takenSeats[buttonPos];
            if (playerSeat) {
              if (playerSeat.missedBlind && !playerSeat.postedBlind) {
                continue;
              }
            }

            if (playerInSeatsInPrevHand[buttonPos] !== 0) {
              break;
            }
          }
          gameUpdate.buttonPos = buttonPos;
        }
        gameUpdate.handNum++;
        maxPlayers = game.maxPlayers;
        let sbPos = buttonPos;
        while (maxPlayers > 0) {
          sbPos++;
          if (sbPos > game.maxPlayers) {
            sbPos = 1;
          }
          if (playerInSeatsInPrevHand[sbPos] !== 0) {
            break;
          }

          // if there is a new player now in this hand
          // and posted the blind, then the new player can play small blind
          if (takenSeats[sbPos]) {
            if (takenSeats[sbPos].postedBlind) {
              break;
            }
          }
          maxPlayers--;
        }
        let bbPos = sbPos;
        maxPlayers = game.maxPlayers;
        while (maxPlayers > 0) {
          bbPos++;
          if (bbPos > game.maxPlayers) {
            bbPos = 1;
          }

          if (takenSeats[bbPos]) {
            const takenSeat = takenSeats[bbPos];

            // this player is in break and missed the blind
            if (takenSeat.status === PlayerStatus.IN_BREAK) {
              missedBlinds.push(bbPos);
            }
          }

          if (occupiedSeats[bbPos] !== 0) {
            break;
          }
          maxPlayers--;
        }
        gameUpdate.sbPos = sbPos;
        gameUpdate.bbPos = bbPos;
        logger.debug(
          `Hand number: ${gameUpdate.handNum} buttonPos: ${buttonPos} sbPos: ${sbPos} bbPos: ${bbPos}`
        );

        // determine new game type (ROE)
        if (game.gameType === GameType.ROE) {
          if (gameUpdate.handNum !== 1) {
            if (buttonPassedDealer) {
              // button passed dealer
              const roeGames = game.roeGames.split(',');
              const gameTypeStr = GameType[gameUpdate.gameType];
              let index = roeGames.indexOf(gameTypeStr.toString());
              index++;
              if (index >= roeGames.length) {
                index = 0;
              }
              gameUpdate.gameType = GameType[roeGames[index]];
            }
          } else {
            const roeGames = game.roeGames.split(',');
            gameUpdate.gameType = GameType[roeGames[0]];
          }
        } else if (game.gameType === GameType.DEALER_CHOICE) {
          if (gameUpdate.handNum === 1) {
            const dealerChoiceGames = game.dealerChoiceGames.split(',');
            gameUpdate.gameType = GameType[dealerChoiceGames[0]];
          }
        } else {
          gameUpdate.gameType = game.gameType;
        }

        let playerInSeatsInThisHand = occupiedSeats;
        if (
          playerInSeatsInPrevHand[sbPos] !== 0 && // there was a player in the previous hand
          occupiedSeats[sbPos] === 0 // the player is not playing this hand or left the game
        ) {
          // we have a dead small now
          // so the next button will move to the dead small seat (not to the current big blind seat)

          // Prev Hand Players: [D, 1, 2, 3, 4], buttonPos: 1, sb: 2, bb: 3
          // * Seat 3 leaves in this hand
          // The new button position is 2, 3: dead small, 4: bb
          // next hand
          // button position: 3 dead button, 4: sb, 1: bb
          playerInSeatsInThisHand = playerInSeatsInPrevHand;
        }

        if (missedBlinds.length > 0) {
          logger.debug(`Players missed blinds: ${missedBlinds.toString()}`);
          const playerGameTrackerRepo = transactionEntityManager.getRepository(
            PlayerGameTracker
          );
          for (const seatNo of missedBlinds) {
            await playerGameTrackerRepo.update(
              {
                game: {id: game.id},
                seatNo: seatNo,
              },
              {
                missedBlind: true,
              }
            );
          }
        }
        const setProps: any = {
          gameType: gameUpdate.gameType,
          prevGameType: prevGameType,
          buttonPos: gameUpdate.buttonPos,
          sbPos: gameUpdate.sbPos,
          bbPos: gameUpdate.bbPos,
          handNum: gameUpdate.handNum,
          playersInLastHand: JSON.stringify(playerInSeatsInThisHand),
          calculateButtonPos: true, // calculate button position for next hand
        };
        // calculate whether we need to do bomb pot next hand
        if (gameSettings.bombPotEnabled) {
          this.determineBombPotNextHand(gameUpdate, gameSettings, setProps);
        }
        // update button pos and gameType
        await gameUpdatesRepo
          .createQueryBuilder()
          .update()
          .set(setProps)
          .where({
            gameID: game.id,
          })
          .execute();
        await Cache.getGameUpdates(game.gameCode, true);

        if (game.gameType === GameType.DEALER_CHOICE) {
          // if the game is dealer's choice, then prompt the user for next hand
          await markDealerChoiceNextHand(game, transactionEntityManager);
        }

        if (prevGameType !== gameUpdate.gameType) {
          // announce the new game type
          logger.debug(
            `Game type is changed. New game type: ${gameUpdate.gameType}`
          );
        }
        return {
          gameCode: this.gameCode,
          handNum: gameUpdate.handNum,
        };
      }
    );
    return ret;
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

        const gameSettings = await GameSettingsRepository.get(game.gameCode);
        if (!gameSettings) {
          throw new Error(
            `Game ${this.gameCode} is not found in PokerGameSettings`
          );
        }

        const gameUpdatesRepo = transactionEntityManager.getRepository(
          PokerGameUpdates
        );
        const gameUpdates = await gameUpdatesRepo.find({
          gameID: game.id,
        });
        if (gameUpdates.length === 0) {
          throw new Error(`Game code: Game updates ${this.gameCode} not found`);
        }

        const playerGameTrackerRepo = transactionEntityManager.getRepository(
          PlayerGameTracker
        );

        const gameUpdate = gameUpdates[0];

        let bombPotThisHand = false;
        logger.debug(
          `Bomb pot next hand num: ${gameUpdate.bombPotNextHandNum} current hand num: ${gameUpdate.handNum}`
        );
        if (gameUpdate.handNum === gameUpdate.bombPotNextHandNum) {
          bombPotThisHand = true;
        }

        const playersInSeats = await GameRepository.getPlayersInSeats(
          game.id,
          transactionEntityManager
        );
        const takenSeats = _.keyBy(playersInSeats, 'seatNo');
        let activeSeats = 0;
        for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
          const playerSeat = takenSeats[seatNo];
          if (
            playerSeat &&
            playerSeat['stack'] <= game.bigBlind &&
            playerSeat['status'] === PlayerStatus.PLAYING
          ) {
            const player = await Cache.getPlayerById(playerSeat['playerId']);
            // if player balance is 0, we need to mark this player to add buyin
            await GameRepository.startBuyinTimer(
              game,
              playerSeat.playerId,
              playerSeat.playerName,
              {
                status: PlayerStatus.WAIT_FOR_BUYIN,
              }
            );
            playerSeat['status'] = PlayerStatus.WAIT_FOR_BUYIN;
          }
        }

        // if we are doing bomb pot this hand,
        // 1. allow only the players who have more than bomb pot bet
        // 2. if a player opted not to do bomb pot exclude them
        // 3. if less than 2 players opted for bomb pot, then don't do bomb pot
        let minBetAmount = game.bigBlind;
        if (bombPotThisHand) {
          minBetAmount = gameSettings.bombPotBet * game.bigBlind;
          let playersWithBombPotStack = 0;
          for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
            const playerSeat = takenSeats[seatNo];
            if (playerSeat && playerSeat.status === PlayerStatus.PLAYING) {
              if (playerSeat.stack >= minBetAmount) {
                playersWithBombPotStack++;
              }
            }
          }

          if (playersWithBombPotStack < 2) {
            // no bomb pots
            minBetAmount = game.bigBlind;
            bombPotThisHand = false;
          }
        }
        const seats = new Array<PlayerInSeat>();

        // push dealer seat
        seats.push({
          seatNo: 0,
          openSeat: false,
          inhand: false,
          activeSeat: false,
          status: PlayerStatus.NOT_PLAYING,
          gameToken: '',
          runItTwicePrompt: false,
          muckLosingHand: false,
          postedBlind: false,
        });
        for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
          let postedBlind = false;
          const playerSeat = takenSeats[seatNo];

          if (!playerSeat) {
            seats.push({
              seatNo: seatNo,
              openSeat: true,
              inhand: false,
              status: PlayerStatus.NOT_PLAYING,
              gameToken: '',
              runItTwicePrompt: false,
              muckLosingHand: false,
              activeSeat: false,
              postedBlind: false,
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
            let activeSeat = true;
            if (playerSeat.status === PlayerStatus.PLAYING) {
              inhand = true;

              /*
              If a player missed a blind and he is natural big blind, 
              then include the player in this hand. Otherwise, mark
              the player to post blind.
              */
              // did this player missed blind?
              if (gameUpdate.bbPos !== seatNo) {
                if (playerSeat.missedBlind) {
                  if (playerSeat.postedBlind) {
                    postedBlind = true;

                    // update the player game tracker that missed blind and posted blind is taken care
                    try {
                      await playerGameTrackerRepo.update(
                        {
                          game: {id: game.id},
                          seatNo: seatNo,
                        },
                        {
                          missedBlind: false,
                          postedBlind: false,
                        }
                      );
                    } catch (err) {
                      // ignore this exception, not a big deal
                    }
                  } else {
                    // this player cannot play
                    playerSeat.status = PlayerStatus.NEED_TO_POST_BLIND;
                    inhand = false;
                  }
                }
              } else {
                // this player is natural big blind, reset missed blind/posted blind if needed
                if (playerSeat.missedBlind) {
                  await playerGameTrackerRepo.update(
                    {
                      game: {id: game.id},
                      seatNo: seatNo,
                    },
                    {
                      missedBlind: false,
                      postedBlind: false,
                    }
                  );
                }
              }
              // don't allow the players who don't have min balance
              if (playerSeat.stack < minBetAmount) {
                inhand = false;
              }

              if (activeSeat) {
                activeSeats++;
              }
            }

            // player is in a seat
            seats.push({
              seatNo: seatNo,
              openSeat: false,
              inhand: inhand,
              activeSeat: activeSeat,
              playerId: playerSeat.playerId,
              playerUuid: playerSeat.playerUuid,
              name: playerSeat.playerName,
              stack: playerSeat.stack,
              buyIn: playerSeat.buyIn,
              status: playerSeat.status,
              runItTwice: playerSeat.runItTwicePrompt,
              buyInTimeExpAt: buyInExpTime,
              breakTimeExpAt: breakTimeExp,
              gameToken: '',
              runItTwicePrompt: playerSeat.runItTwicePrompt,
              muckLosingHand: playerSeat.muckLosingHand,
              postedBlind: postedBlind,
            });
          }
        }
        let tableStatus = game.tableStatus;
        const gameStatus = game.status;
        if (activeSeats === 1) {
          // not enough players
          await GameRepository.markTableStatus(
            game.id,
            TableStatus.NOT_ENOUGH_PLAYERS
          );
          tableStatus = TableStatus.NOT_ENOUGH_PLAYERS;
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
        let doubleBoard = false;
        if (bombPotThisHand) {
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
          gameStatus: gameStatus,
          tableStatus: tableStatus,
          sbPos: gameUpdate.sbPos,
          bbPos: gameUpdate.bbPos,
          resultPauseTime: 5000,
          bombPot: bombPotThisHand,
          doubleBoardBombPot: doubleBoard,
          bombPotBet: gameSettings.bombPotBet,
          // Not implemented yet (do we need it?)
          bringIn: 0,
        };
        return nextHandInfo;
      }
    );
    return ret;
  }

  private determineBombPotNextHand(
    gameUpdate: PokerGameUpdates,
    gameSettings: PokerGameSettings,
    setProps: any
  ) {
    if (!gameSettings.bombPotEnabled) {
      return;
    }
    const now = new Date();
    const intervalInMs = gameSettings.bombPotInterval * 1000;
    const nextBombPotTime = new Date(
      gameUpdate.lastBombPotTime.getTime() + intervalInMs
    );
    logger.debug(
      `Next bomb time: ${nextBombPotTime.toISOString()} now: ${now.toISOString()}`
    );
    if (now.getTime() > nextBombPotTime.getTime()) {
      logger.debug(`Game: ${this.gameCode} Time for next bomb pot`);
      setProps.bombPotNextHandNum = this.gameServerHandNum + 1;
      setProps.lastBombPotTime = now;
    }
  }
}
