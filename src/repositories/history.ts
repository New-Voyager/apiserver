import {PlayerGameTracker} from '@src/entity/game/chipstrack';
import {PokerGame, PokerGameUpdates} from '@src/entity/game/game';
import {GameHistory} from '@src/entity/history/game';
import {HighHandHistory} from '@src/entity/history/hand';
import {PlayersInGame} from '@src/entity/history/player';
import {HighHand} from '@src/entity/player/reward';
import {playerTransactions} from '@src/resolvers/accounting';
import {getManager, getRepository} from 'typeorm';

class HistoryRepositoryImpl {
  constructor() {}

  public async newGameCreated(game: PokerGame) {
    const gameHistoryRepo = getRepository(GameHistory);
    const gameHistory = new GameHistory();
    gameHistory.gameId = game.id;
    gameHistory.gameCode = game.gameCode;
    gameHistory.clubId = game.clubId;
    gameHistory.dealerChoiceGames = game.dealerChoiceGames;
    gameHistory.smallBlind = game.smallBlind;
    gameHistory.bigBlind = game.bigBlind;
    gameHistory.gameCode = game.gameCode;
    gameHistory.gameType = game.gameType;
    gameHistory.hostId = game.hostId;
    gameHistory.hostName = game.hostName;
    gameHistory.hostUuid = game.hostUuid;
    gameHistory.roeGames = game.roeGames;
    gameHistory.startedAt = game.startedAt;
    await gameHistoryRepo.save(gameHistory);
  }

  public async gameEnded(
    game: PokerGame,
    updates: PokerGameUpdates | undefined
  ) {
    const values: any = {
      endedAt: game.endedAt,
      endedBy: game.endedBy,
      endedByName: game.endedByName,
    };
    if (updates) {
      values.handsDealt = updates.handNum;
    }
    await getManager().transaction(async transactionEntityManager => {
      await transactionEntityManager
        .createQueryBuilder()
        .update(GameHistory)
        .set(values)
        .where('gameId = :gameId', {gameId: game.id})
        .execute();

      const playersInGameRepo = transactionEntityManager.getRepository(
        PlayersInGame
      );
      const playerGameTrackerRepo = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
      const players = await playerGameTrackerRepo.find({
        where: {
          game: {id: game.id},
        },
      });

      for (const player of players) {
        const playersInGame = new PlayersInGame();
        playersInGame.buyIn = player.buyIn;
        playersInGame.handStack = player.handStack;
        playersInGame.leftAt = player.leftAt;
        playersInGame.noHandsPlayed = player.noHandsPlayed;
        playersInGame.noHandsWon = player.noHandsWon;
        playersInGame.noOfBuyins = player.noOfBuyins;
        playersInGame.playerId = player.playerId;
        playersInGame.playerName = player.playerName;
        playersInGame.playerUuid = player.playerUuid;
        playersInGame.sessionTime = player.sessionTime;
        playersInGame.gameId = game.id;

        await playersInGameRepo.save(playersInGame);
      }

      const highHandHistoryRepo = getRepository(HighHandHistory);
      const highHandRepo = getRepository(HighHand);
      const highHands = await highHandRepo.find({
        where: {
          gameId: game.id,
        },
      });

      for (const highHand of highHands) {
        const highHandHistory = new HighHandHistory();
        highHandHistory.boardCards = highHand.boardCards;
        highHandHistory.endHour = highHand.endHour;
        highHandHistory.gameId = highHand.gameId;
        highHandHistory.handNum = highHand.handNum;
        highHandHistory.handTime = highHand.handTime;
        highHandHistory.highHand = highHand.highHand;
        highHandHistory.highHandCards = highHand.highHandCards;
        highHandHistory.playerCards = highHand.playerCards;
        highHandHistory.playerId = highHand.player.id;
        highHandHistory.rank = highHand.rank;
        highHandHistory.rewardId = highHand.reward.id;
        highHandHistory.rewardTrackingId = highHand.rewardTracking.id;
        highHandHistory.startHour = highHand.startHour;
        highHandHistory.winner = highHand.winner;

        await highHandHistoryRepo.save(highHandHistory);
      }
    });
  }

  public async getGameHistory(
    hostId: string,
    clubId: number | null
  ): Promise<GameHistory[]> {
    const gameHistory = await getRepository(GameHistory)
      .createQueryBuilder()
      .where('club_id = :clubId OR host_id = :hostId', {
        clubId: clubId,
        hostId: hostId,
      })
      .getMany();
    return gameHistory;
  }

  public async getPlayersInGame(gameId: number): Promise<PlayersInGame[]> {
    const playersInGameRepo = await getRepository(PlayersInGame);
    const playersInGame = playersInGameRepo.find({where: {gameId: gameId}});
    return playersInGame;
  }
}

export const HistoryRepository = new HistoryRepositoryImpl();
