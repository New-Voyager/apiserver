import {
  getGameManager,
  getHistoryConnection,
  getHistoryManager,
  getHistoryRepository,
  getUserManager,
} from '.';
import {GameHistory} from '@src/entity/history/game';
import {
  ClubStats,
  PlayerGameStats,
  PlayerHandStats,
} from '@src/entity/history/stats';
import {HandHistory, HighHandHistory} from '@src/entity/history/hand';
import {errToStr, getLogger} from '@src/utils/log';
import {performance} from 'perf_hooks';
import {PlayersInGame} from '@src/entity/history/player';
import {
  GameReward,
  GameRewardTracking,
  HighHand,
} from '@src/entity/game/reward';
import {GameServer} from '@src/entity/game/gameserver';
import {
  HostSeatChangeProcess,
  PlayerSeatChangeProcess,
} from '@src/entity/game/seatchange';
import {
  NextHandUpdates,
  PokerGame,
  PokerGameSeatInfo,
  PokerGameSettings,
  PokerGameUpdates,
} from '@src/entity/game/game';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {Announcement} from '@src/entity/player/announcements';
import {ChatText} from '@src/entity/player/chat';
import {
  Club,
  ClubMember,
  ClubMemberStat,
  CreditTracking,
} from '@src/entity/player/club';
import {
  ClubHostMessages,
  ClubMessageInput,
} from '@src/entity/player/clubmessage';
import {
  CoinConsumeTransaction,
  CoinPurchaseTransaction,
  PlayerCoin,
} from '@src/entity/player/appcoin';
import {Player, PlayerNotes, SavedHands} from '@src/entity/player/player';
import {Promotion} from '@src/entity/player/promotion';
import {PromotionConsumed} from '@src/entity/player/promotion_consumed';
import {Reward} from '@src/entity/player/reward';
import {Cache} from '@src/cache/index';
import {HistoryRepository} from './history';
import {GameNotFoundError} from '@src/errors';
import {HandRepository} from './hand';
import {cardNumber, stringCards} from '@src/utils';
import _ from 'lodash';

const logger = getLogger('repositories::admin');

class AdminRepositoryImpl {
  constructor() {}

  public async checkDbTransaction() {
    await getHistoryManager().transaction(async txnMgr => {
      const historyEntities = [
        ClubStats,
        GameHistory,
        HandHistory,
        HighHandHistory,
        PlayerGameStats,
        PlayerHandStats,
        PlayersInGame,
      ];
      for (const e of historyEntities) {
        await txnMgr.getRepository(e).find({take: 1});
      }
    });
    await getGameManager().transaction(async txnMgr => {
      const gameEntities = [
        GameReward,
        GameRewardTracking,
        GameServer,
        HighHand,
        HostSeatChangeProcess,
        NextHandUpdates,
        PlayerGameTracker,
        PlayerSeatChangeProcess,
        PokerGame,
        PokerGameSeatInfo,
        PokerGameSettings,
        PokerGameUpdates,
      ];
      for (const e of gameEntities) {
        await txnMgr.getRepository(e).find({take: 1});
      }
    });
    await getUserManager().transaction(async txnMgr => {
      const userEntities = [
        Announcement,
        ChatText,
        Club,
        ClubHostMessages,
        ClubMember,
        ClubMemberStat,
        CreditTracking,
        ClubMessageInput,
        CoinConsumeTransaction,
        CoinPurchaseTransaction,
        Player,
        PlayerCoin,
        PlayerNotes,
        Promotion,
        PromotionConsumed,
        Reward,
        SavedHands,
      ];
      for (const e of userEntities) {
        await txnMgr.getRepository(e).find({take: 1});
      }
    });
  }

  public async postProcessGames(req: any, resp: any) {
    const processedGameIds: Array<number> = [];
    try {
      logger.info('Starting post processing');
      const startTime = performance.now();

      const repo = getHistoryRepository(GameHistory);
      const allGames = await repo.find({status: 4, dataAggregated: false});
      allGames.map(async value => {
        await getHistoryManager().transaction(
          async transactionalEntityManager => {
            const handHistoryRepo =
              transactionalEntityManager.getRepository(HandHistory);
            const playerStatsFromHandHistory = await handHistoryRepo.find({
              gameId: value.gameId,
            });
            let playerMap = {};
            const playerStats = JSON.parse(
              playerStatsFromHandHistory[0].playersStats
            );
            let counter = 1;
            for (const key in playerStats.playerRound) {
              Object.defineProperty(playerMap, key, {
                value: {
                  inPreflop: 0,
                  inFlop: 0,
                  inTurn: 0,
                  inRiver: 0,
                  wentToShowDown: 0,
                  wonAtShowDown: 0,
                  headsupHands: 0,
                  wonHeadsupHands: 0,
                  preflopRaise: 0,
                  postflopRaise: 0,
                  threeBet: 0,
                  contBet: 0,
                  vpipCount: 0,
                  allInCount: 0,
                  headsupHandDetails: [],
                },
              });
              const rounds = playerStats.playerRound;
              playerMap[key].inPreflop += rounds[key].preflop;
              playerMap[key].inFlop += rounds[key].flop;
              playerMap[key].inTurn += rounds[key].turn;
              playerMap[key].inRiver += rounds[key].river;
            }
            for (const key in playerStats.playerStats) {
              const stats = playerStats.playerStats;
              playerMap[key].wentToShowDown += stats[key].wentToShowdown
                ? 1
                : 0;
              playerMap[key].headsupHands += stats[key].headsup ? 1 : 0;
              playerMap[key].wonHeadsupHands += stats[key].wonHeadsup ? 1 : 0;
              playerMap[key].preflopRaise += stats[key].preflopRaise ? 1 : 0;
              playerMap[key].postflopRaise += stats[key].postflopRaise ? 1 : 0;
              playerMap[key].threeBet += stats[key].threeBet ? 1 : 0;
              playerMap[key].contBet += stats[key].cbet ? 1 : 0;
              playerMap[key].vpipCount += stats[key].vpip ? 1 : 0;
              playerMap[key].allInCount += stats[key].allin ? 1 : 0;
              if (stats[key].headsup) {
                playerMap[key].headsupHandDetails.push({
                  handNum: counter,
                  otherPlayer: stats[key].headsupPlayer,
                  won: stats[key].wonHeadsup,
                });
                counter++;
              }
              await transactionalEntityManager
                .getRepository(PlayerGameStats)
                .update(
                  {
                    gameId: value.gameId,
                    playerId: parseInt(key),
                  },
                  playerMap[key]
                );
            }
            await repo.update(
              {
                gameId: value.gameId,
              },
              {
                dataAggregated: true,
              }
            );
          }
        );
        processedGameIds.push(value.gameId);
      });

      const endTime = performance.now();
      logger.info(
        `Post processing of ${processedGameIds.length} games took ${
          endTime - startTime
        } ms. Processed game IDs - [${processedGameIds}]`
      );
    } catch (err) {
      logger.error(`Error during post processing: ${errToStr(err)}`);
      resp.status(500).send({
        processedGameIds: [],
      });
      return;
    }
    resp.status(200).send({
      processedGameIds: processedGameIds,
    });
  }

  public async analyzeHands(gameCode: string) {
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
    ret.secondBoardCount = 0;
    ret.pairedSecondBoards = [];
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
        let cards = board.cards;
        if (cards.length >= 5) {
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
        }

        if (handLog.result.boards.length >= 2) {
          const board = handLog.result.boards[1];
          let cards = board.cards;
          ret.secondBoardCount++;
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
            ret.pairedSecondBoards.push(board);
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
    let sortedHands = _.sortBy(allHands, function (hand) {
      return hand.handNum;
    });

    const invalidCalcHands = new Array<any>();
    for (const hand of sortedHands) {
      let playersInHand: any = hand.playersStack as any;
      if (typeof playersInHand == 'string') {
        playersInHand = JSON.stringify(playersInHand);
      }
      const handData = hand.data as any;
      const playerInfo = _.keyBy(handData.result.playerInfo, 'id');
      for (const playerId of Object.keys(playersInHand)) {
        const playerBalance = playersInHand[playerId];
        const before = playerBalance.b;
        const after = playerBalance.a;

        const player = playerInfo[playerId];
        const afterHand = before + player.received + player.rakePaid;
        if (afterHand !== after) {
          invalidCalcHands.push(hand.handNum);
        }
      }
    }
    ret.handIssues = invalidCalcHands;

    // make sure balance matches
    const resultTable = await HistoryRepository.getGameResultTable(gameCode);
    if (resultTable) {
      let buyin = 0;
      let stackAndTip = 0;
      for (const result of resultTable) {
        buyin += result.buyIn;
        stackAndTip += result.stack;
        if (result.rakePaid) {
          stackAndTip += result.rakePaid;
        }
      }
      ret.balanceMismatch = false;
      if (buyin != stackAndTip) {
        // balance mismatch
        ret.balanceMismatch = true;
      }
      ret.result = resultTable;
    }

    return ret;
  }
}

export const AdminRepository = new AdminRepositoryImpl();
