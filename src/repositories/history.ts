import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {PokerGame, PokerGameUpdates} from '@src/entity/game/game';
import {GameHistory} from '@src/entity/history/game';
import {HighHandHistory} from '@src/entity/history/hand';
import {PlayersInGame} from '@src/entity/history/player';
import {fixQuery} from '@src/utils';
import {ClubMemberStatus, ClubStatus, GameStatus} from '@src/entity/types';
import {Cache} from '@src/cache/index';
import {getRakeCollected} from '@src/resolvers/chipstrack';
import {PlayerGameStats} from '@src/entity/history/stats';
import {completedGame} from '@src/resolvers/game';
import {getGameRepository, getHistoryManager, getHistoryRepository} from '.';
import {HighHand} from '@src/entity/game/reward';

class HistoryRepositoryImpl {
  constructor() {}

  public async newGameCreated(game: PokerGame) {
    const gameHistoryRepo = getHistoryRepository(GameHistory);
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
    gameHistory.maxPlayers = game.maxPlayers;
    gameHistory.maxWaitlist = game.maxWaitlist;
    gameHistory.title = game.title;
    gameHistory.status = game.status;
    gameHistory.clubCode = game.clubCode;
    gameHistory.gameNum = game.gameNum;

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
    await getHistoryManager().transaction(async transactionEntityManager => {
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
        playersInGame.rakePaid = player.rakePaid;
        playersInGame.status = player.status;
        playersInGame.stack = player.stack;

        await playersInGameRepo.save(playersInGame);
      }

      const highHandHistoryRepo = getHistoryRepository(HighHandHistory);
      const highHandRepo = getGameRepository(HighHand);
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
        highHandHistory.playerId = highHand.playerId;
        highHandHistory.rank = highHand.rank;
        highHandHistory.rewardId = highHand.rewardId;
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
    const gameHistory = await getHistoryRepository(GameHistory)
      .createQueryBuilder()
      .where('club_id = :clubId OR host_id = :hostId', {
        clubId: clubId,
        hostId: hostId,
      })
      .getMany();
    return gameHistory;
  }

  public async getPlayersInGame(gameId: number): Promise<PlayersInGame[]> {
    const playersInGameRepo = await getHistoryRepository(PlayersInGame);
    const playersInGame = playersInGameRepo.find({where: {gameId: gameId}});
    return playersInGame;
  }

  public async getCompletedGame(
    gameCode: string,
    playerId: number
  ): Promise<any> {
    const gameRepo = getHistoryRepository(GameHistory);
    const game = await gameRepo.findOne({gameCode: gameCode});
    let completedGame: any;
    if (game) {
      const playerRepo = getHistoryRepository(PlayersInGame);
      const player = await playerRepo.findOne({
        gameId: game.gameId,
        playerId: playerId,
      });
      if (player) {
        const gameStatsRepo = getHistoryRepository(PlayerGameStats);
        const gameStat = await gameStatsRepo.findOne({
          gameId: game.gameId,
          playerId: player.playerId,
        });
        if (gameStat) {
          completedGame = {
            gameCode: game.gameCode,
            gameNum: game.gameNum,
            sessionTime: player.sessionTime,
            status: game.status,
            smallBlind: game.smallBlind,
            bigBlind: game.bigBlind,
            handsPlayed: player.noHandsPlayed,
            handsWon: player.noHandsWon,
            inTurns: gameStat.inTurn,
            buyIn: player.buyIn,
            profit: player.stack - player.buyIn,
            preFlopHands: gameStat.inPreflop,
            riverHands: gameStat.inRiver,
            showDownHands: gameStat.wentToShowDown,
            gameType: game.gameType,
            startedAt: game.startedAt,
            startedBy: game.hostName,
            endedAt: game.endedAt,
            endedBy: game.endedBy,
            balance: player.stack,
            handsDealt: game.handsDealt,
          };
        }
      }
    }
    return completedGame;
  }

  public async getPastGames(playerId: string) {
    // get the list of past games associated with player clubs
    const playersRepo = getHistoryRepository(PlayersInGame);
    const players = await playersRepo.find({playerUuid: playerId});
    const pastGames = new Array<any>();
    players.forEach(async player => {
      const gameRepo = getHistoryRepository(GameHistory);
      const game = await gameRepo.findOne({gameId: player.gameId});
      if (game) {
        const club = await Cache.getClub(game.clubCode);
        if (club) {
          const pastGame = {
            gameCode: game.gameCode,
            gameId: game.gameId,
            title: game.title,
            gameType: game.gameType,
            gameTime: game.endedAt.valueOf() - game.startedAt.valueOf(),
            startedAt: game.startedAt,
            endedAt: game.endedAt,
            maxPlayers: game.maxPlayers,
            maxWaitList: game.maxWaitlist,
            handsDealt: game.handsDealt,
            playerStatus: player.status,
            sessionTime: player.sessionTime,
            buyIn: player.buyIn,
            stack: player.stack,
            clubCode: club.clubCode,
            clubName: club.name,
          };
          pastGames.push(pastGame);
        }
      }
    });
    return pastGames;
  }

  public async getGameResultTable(gameCode: string): Promise<any> {
    const gameRepo = getHistoryRepository(GameHistory);
    const games = await gameRepo.find({gameCode: gameCode});
    const gameResults = new Array<any>();
    games.forEach(async game => {
      const playersRepo = getHistoryRepository(PlayersInGame);
      const player = await playersRepo.findOne({gameId: game.gameId});
      if (player) {
        const gameResult = {
          sessionTime: player.sessionTime,
          sessionTimeStr: player.sessionTime.toString(),
          handsPlayed: player.noHandsPlayed,
          buyIn: player.buyIn,
          rakePaid: player.rakePaid,
          profit: player.stack - player.buyIn,
          playerName: player.playerName,
          playerUuid: player.playerUuid,
        };
        gameResults.push(gameResult);
      }
    });
    return gameResults;
  }
}

export const HistoryRepository = new HistoryRepositoryImpl();
