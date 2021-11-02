import {ClubRepository} from '@src/repositories/club';
import {HandRepository} from '@src/repositories/hand';
import {Cache} from '@src/cache/index';
import {errToStr, getLogger} from '@src/utils/log';
import {HistoryRepository} from '@src/repositories/history';
import {GameNotFoundError} from '@src/errors';
import {cardNumber, stringCards} from '@src/utils';
import _ from 'lodash';
import assert from 'assert';

const logger = getLogger('internal::admin');

/**
 * These APIs are only available for testdriver.
 */
class AdminAPIs {
  public async deleteClub(req: any, resp: any) {
    const clubName = req.params.clubName;
    if (!clubName) {
      const res = {error: 'Invalid club name'};
      resp.status(500).send(JSON.stringify(res));
    }
    try {
      await ClubRepository.deleteClubByName(clubName);
      resp.status(200).send({status: 'OK'});
    } catch (err) {
      logger.error(errToStr(err));
      resp.status(500).send({error: errToStr(err)});
    }
  }

  public async dataRetention(req: any, resp: any) {
    try {
      const handHistoryDeleted = await HandRepository.cleanUpOldData();
      resp.status(200).send({handHistory: handHistoryDeleted});
    } catch (err) {
      logger.error(`Error in data retention process: ${errToStr(err)}`);
      resp.status(500).json({error: errToStr(err)});
    }
  }

  public async handAnalysis(req: any, resp: any) {
    const gameCode = req.params.gameCode;
    try {
      if (!gameCode) {
        const res = {error: 'Invalid game code'};
        resp.status(500).send(JSON.stringify(res));
        return;
      }

      // check whether this live game or history games
      const game = await Cache.getGame(gameCode);
      let gameId = 0;
      let gameInfo: any = {};

      if (!game) {
        // history game
        const gameHistory = await HistoryRepository.getHistoryGame(gameCode);
        if (!gameHistory) {
          throw new GameNotFoundError(gameCode);
        }
        gameId = gameHistory.gameId;
        gameInfo.gameCode = gameHistory.gameCode;
        gameInfo.gameType = gameHistory.gameType;
        gameInfo.handsDealt = gameHistory.handsDealt;
        gameInfo.startedBy = gameHistory.startedBy;
        gameInfo.endedAt = gameHistory.endedAt?.toISOString();
        gameInfo.smallBlind = gameHistory.smallBlind;
        gameInfo.bigBlind = gameHistory.bigBlind;
      } else {
        // live game
        gameId = game.id;
        const gameUpdates = await Cache.getGameUpdates(gameCode);
        const startedByPlayer = await Cache.getPlayerById(game.startedBy);
        gameInfo.gameCode = game.gameCode;
        gameInfo.gameType = game.gameType;
        gameInfo.handsDealt = gameUpdates.handNum;
        gameInfo.startedBy = startedByPlayer.name;
        gameInfo.endedAt = game.endedAt?.toISOString();
        gameInfo.smallBlind = game.smallBlind;
        gameInfo.bigBlind = game.bigBlind;
      }
      const allHands = await HandRepository.getAllHandHistory(gameId);

      /*
      hand-analysis
      - game info
          player's stack before, after
      - paired board hands 
          [hand num, board cards]
      - straight flushes
          [hand num, board cards, player cards]
      - four of kind hands
          [hand num, board cards, player cards]
      - full house hands
          [hand num, board cards, player cards]
      - two or more players with same ranked hands
          [hand num, [{player cards}]]
      */

      let ret: any = {};
      ret.game = gameInfo;
      ret.pairedBoards = [];
      ret.flopPairedBoards = [];
      ret.turnPairedBoards = [];
      ret.riverPairedBoards = [];
      ret.straightFlushes = [];
      ret.fourOfKinds = [];
      ret.fullHouseHands = [];
      ret.sameCards = [];

      for (const hand of allHands) {
        const handLog = hand.data as any;
        const log = JSON.stringify(handLog);
        if (
          handLog.result &&
          handLog.result.boards &&
          handLog.result.boards.length >= 1
        ) {
          const board = handLog.result.boards[0];
          const cards = board.cards;
          assert(cards.length === 5);

          // find out whether we have paired cards on the board
          let cardNumbers: any = {};
          let pairedAt = 0;
          for (let i = 0; i < 5; i++) {
            const card = cards[i];
            const n = cardNumber(card);
            if (cardNumbers[n]) {
              // paired board
              pairedAt = i + 1;
              break;
            }
            cardNumbers[n] = 1;
          }

          if (pairedAt > 0) {
            let board = {
              cards: cards,
              str: stringCards(cards),
            };
            ret.pairedBoards.push(board);
            if (pairedAt <= 3) {
              ret.flopPairedBoards.push(board);
            } else if (pairedAt === 4) {
              ret.turnPairedBoards.push(board);
            } else {
              ret.riverPairedBoards.push(board);
            }
          }

          // check player's rank
          const playersRank = board.playerRank;
          for (const seatNo of Object.keys(playersRank)) {
            const player = playersRank[seatNo];

            if (player.hiRank > 0) {
              let board = {
                'hand-num': hand.handNum,
                'board-cards': cards,
                'board-str': stringCards(cards),
                'player-cards': player.hiCards,
                'player-cards-str': stringCards(player.hiCards),
              };
              if (player.hiRank >= 1 && player.hiRank <= 10) {
                // straight flush
                ret.straightFlushes.push(board);
              } else if (player.hiRank <= 166) {
                // four of a kind
                ret.fourOfKinds.push(board);
              } else if (player.hiRank <= 322) {
                // full house
                ret.fullHouseHands.push(board);
              }
            }
          }
        }

        if (handLog.result && handLog.result.playerInfo) {
          const playerInfo = handLog.result.playerInfo;
          const playerCardNum: any = {};
          for (const seatNo of Object.keys(playerInfo)) {
            const player = playerInfo[seatNo];
            const cards = player.cards;
            const playerCardNumbers = new Array<number>();
            for (const card of cards) {
              playerCardNumbers.push(cardNumber(card));
            }
            playerCardNum[seatNo] = playerCardNumbers;
          }

          let sameHoleCardsFound = false;
          let matchPlayer1;
          let matchPlayer2;
          // we converted cards to card numbers
          let matchesFound = 0;
          // let us find more than one card found in other players hole cards
          for (const seatNo of Object.keys(playerCardNum)) {
            const player1 = playerCardNum[seatNo];
            for (const seatNo2 of Object.keys(playerCardNum)) {
              if (seatNo == seatNo2) {
                // same player
                continue;
              }

              let seenCards: any = {};
              matchesFound = 0;
              let player1Cards = _.sortBy(playerCardNum[seatNo]);
              let player2Cards = _.sortBy(playerCardNum[seatNo2]);
              let player1Card;
              let player2Card;
              for (player1Card of player1Cards) {
                if (seenCards[player1Card]) {
                  continue;
                }
                seenCards[player1Card] = true;
                for (player2Card of player2Cards) {
                  if (player1Card == player2Card) {
                    matchesFound++;
                    break;
                  }
                }
              }

              if (matchesFound >= 2) {
                // more than 2 cards matched in both players hole cards
                sameHoleCardsFound = true;
                matchPlayer1 = player1Cards;
                matchPlayer2 = player2Cards;
                break;
              }
            }

            if (sameHoleCardsFound) {
              break;
            }
          }

          if (sameHoleCardsFound) {
            // output all player's cards
            let playerCards = new Array<any>();
            for (const seatNo of Object.keys(playerInfo)) {
              const player = playerInfo[seatNo];
              playerCards.push({
                seatNo: seatNo,
                'player-cards': player.cards,
                'player-cards-str': stringCards(player.cards),
              });
            }
            ret.sameCards.push(playerCards);
          }
        }
      }

      ret.game.pairedBoards = ret.pairedBoards.length;
      ret.game.flopPairedBoards = ret.flopPairedBoards.length;
      ret.game.turnPairedBoards = ret.turnPairedBoards.length;
      ret.game.riverPairedBoards = ret.riverPairedBoards.length;
      ret.game.straightFlushes = ret.straightFlushes.length;
      ret.game.fourOfKinds = ret.fourOfKinds.length;
      ret.game.fullHouseHands = ret.fullHouseHands.length;
      ret.game.sameRankHolecards = ret.sameCards.length;

      resp.status(200).send(ret);
    } catch (err) {
      logger.error(
        `Could get hand history for game ${gameCode}. Error: ${errToStr(err)}`
      );
      resp.status(500).json({error: errToStr(err)});
    }
  }
}

export const AdminAPI = new AdminAPIs();
