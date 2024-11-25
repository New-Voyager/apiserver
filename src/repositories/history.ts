import { PlayerGameTracker } from '@src/entity/game/player_game_tracker';
import { PokerGame, PokerGameSettings } from '@src/entity/game/game';
import { GameHistory } from '@src/entity/history/game';
import { HighHandHistory } from '@src/entity/history/hand';
import { PlayersInGame } from '@src/entity/history/player';
import { Cache } from '@src/cache/index';
import {
  getGameRepository,
  getHistoryConnection,
  getHistoryManager,
  getHistoryRepository,
} from '.';
import { HighHand } from '@src/entity/game/reward';
import { Club, ClubMember } from '@src/entity/player/club';
import { ClubRepository } from './club';
import { In, IsNull, Not } from 'typeorm';
import _ from 'lodash';
import { Player } from '@src/entity/player/player';
import { ChipUnit, GameEndReason, GameStatus, GameType } from '@src/entity/types';
import { stat, Stats } from 'fs';
import { StatsRepository } from './stats';
import { GameNotFoundError } from '@src/errors';
import { fixQuery } from '@src/utils';

class HistoryRepositoryImpl {
  constructor() { }

  public async updateGameNum(gameId: number, gameNum) {
    await getHistoryRepository(GameHistory).update(
      {
        gameId: gameId,
      },
      {
        gameNum: gameNum,
      }
    );
  }
  public async newGameCreated(
    game: PokerGame,
    gameSettings: PokerGameSettings
  ) {
    const gameHistoryRepo = getHistoryRepository(GameHistory);
    const gameHistory = new GameHistory();
    gameHistory.gameId = game.id;
    gameHistory.gameCode = game.gameCode;
    gameHistory.clubId = game.clubId;
    gameHistory.smallBlind = game.smallBlind;
    gameHistory.bigBlind = game.bigBlind;
    gameHistory.gameCode = game.gameCode;
    gameHistory.chipUnit = game.chipUnit;
    gameHistory.gameType = game.gameType;
    gameHistory.startedBy = game.startedBy;
    gameHistory.startedByName = game.startedByName;
    gameHistory.startedAt = game.startedAt;
    gameHistory.maxPlayers = game.maxPlayers;
    gameHistory.highHandTracked = game.highHandTracked;
    gameHistory.title = game.title;
    gameHistory.status = game.status;
    gameHistory.clubCode = game.clubCode;
    gameHistory.gameNum = game.gameNum;
    gameHistory.rakePercentage = game.rakePercentage;
    gameHistory.rakeCap = game.rakeCap;
    gameHistory.audioConfEnabled = gameSettings.audioConfEnabled;
    gameHistory.roeGames = gameSettings.roeGames;
    gameHistory.dealerChoiceGames = gameSettings.dealerChoiceGames;
    gameHistory.demoGame = game.demoGame;
    gameHistory.lobbyGame = game.lobbyGame;

    await gameHistoryRepo.save(gameHistory);
  }

  public async gameEnded(
    game: PokerGame,
    handsDealt: number,
    endReason: GameEndReason
  ) {
    let endedAt: Date = game.endedAt;
    if (!endedAt) {
      endedAt = new Date();
    }
    const values: any = {
      status: GameStatus.ENDED,
      startedAt: game.startedAt,
      endedAt: endedAt,
      endedBy: game.endedBy,
      endedByName: game.endedByName,
      endReason: endReason,
    };
    values.handsDealt = handsDealt;
    await getHistoryManager().transaction(async transactionEntityManager => {
      await transactionEntityManager
        .createQueryBuilder()
        .update(GameHistory)
        .set(values)
        .where('gameId = :gameId', { gameId: game.id })
        .execute();

      const playersInGameRepo =
        transactionEntityManager.getRepository(PlayersInGame);
      const playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
      const players = await playerGameTrackerRepo.find({
        where: {
          game: { id: game.id },
        },
      });

      for (const player of players) {
        let playerInGameRow = await playersInGameRepo.find({
          gameId: game.id,
          playerId: player.id,
          sessionNo: player.sessionNo,
        });

        let playersInGame: PlayersInGame;
        if (playerInGameRow.length == 0) {
          playersInGame = new PlayersInGame();
        } else {
          playersInGame = playerInGameRow[0];
        }

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
        playersInGame.sessionNo = player.sessionNo;
        playersInGame.sessionStartTime = player.sessionStartTime;
        playersInGame.sessionLeftTime = player.sessionLeftTime;
        playersInGame.creditsSettled = player.creditsSettled;
        playersInGame.disconnectCount = player.disconnectCount;
        playersInGame.refreshCount = player.refreshCount;
        await playersInGameRepo.save(playersInGame);
      }

      const highHandHistoryRepo =
        transactionEntityManager.getRepository(HighHandHistory);
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
        if (highHand.rewardId) {
          highHandHistory.rewardId = highHand.rewardId;
        }
        if (highHand.rewardTracking) {
          highHandHistory.rewardTrackingId = highHand.rewardTracking.id;
        }
        highHandHistory.startHour = highHand.startHour;
        highHandHistory.winner = highHand.winner;

        await highHandHistoryRepo.save(highHandHistory);
      }
    });
  }

  public async getGameHistoryByGameCode(
    playerUuid: string,
    gameCode: string
  ): Promise<any | null> {
    const gameRepo = getHistoryRepository(GameHistory);
    let gameHistory: GameHistory | undefined;
    gameHistory = await gameRepo.findOne({
      where: {
        gameCode: gameCode,
      },
    });
    if (!gameHistory) {
      return gameHistory;
    }
    const cachedPlayer = await Cache.getPlayer(playerUuid);
    let clubMember;
    if (gameHistory.clubCode) {
      clubMember = await Cache.getClubMember(playerUuid, gameHistory.clubCode);
    }
    const completedGames = await this.completeData(
      cachedPlayer,
      [gameHistory],
      clubMember,
      true
    );
    return completedGames[0];
  }

  public async getGameHistory(playerUuid: string, club: Club | undefined) {
    const gameRepo = getHistoryRepository(GameHistory);
    let gameHistory: Array<GameHistory>;
    let clubMember;
    const playerRepo = getHistoryRepository(PlayersInGame);
    const cachedPlayer = await Cache.getPlayer(playerUuid);

    if (club) {
      clubMember = await Cache.getClubMember(playerUuid, club.clubCode);
      // club games
      gameHistory = await gameRepo.find({
        where: {
          clubCode: club.clubCode,
        },
        take: 25,
      });
    } else {
      // select first 25 player games
      const games = await playerRepo
        .createQueryBuilder()
        .select('game_id', 'gameId')
        .where({
          playerId: cachedPlayer.id,
        })
        .take(25)
        .execute();
      const gameIds = _.map(games, e => e.gameId);
      gameHistory = await gameRepo.find({
        where: {
          gameId: In(gameIds),
        },
      });
    }
    const completedGames = await this.completeData(
      cachedPlayer,
      gameHistory,
      clubMember,
      false
    );
    return completedGames;
  }

  private async completeData(
    cachedPlayer: Player,
    gameHistory: Array<GameHistory>,
    clubMember: ClubMember | null,
    includeStats: boolean
  ) {
    const playerRepo = getHistoryRepository(PlayersInGame);
    let dataAggregated = false;
    let completedGames: Array<any> = new Array<any>();
    for (const game of gameHistory) {
      let completedGame: any;
      let gameData: any = {
        gameId: game.gameId,
        gameCode: game.gameCode,
        gameNum: game.gameNum,
        status: game.status,
        smallBlind: game.smallBlind,
        bigBlind: game.bigBlind,
        highHandTracked: game.highHandTracked,
        gameType: game.gameType,
        startedAt: game.startedAt,
        startedBy: game.startedByName,
        endedAt: game.endedAt,
        endedBy: game.endedByName,
        handsDealt: game.handsDealt,
        dataAggregated: game.dataAggregated,
        handDataLink: game.handDataLink,
        chipUnit: ChipUnit[game.chipUnit],
      };
      dataAggregated = game.dataAggregated;
      gameData.isHost = false;
      if (cachedPlayer) {
        if (game.startedBy === cachedPlayer.id) {
          gameData.isHost = true;
        }
      }
      if (clubMember) {
        gameData.isOwner = clubMember.isOwner;
        gameData.isManager = clubMember.isManager;
      }
      if (includeStats && dataAggregated) {
        const stats = await StatsRepository.getPlayerGameStats(
          cachedPlayer.uuid,
          game.gameId
        );
        if (stats) {
          gameData.preflopHands = stats.inPreflop;
          gameData.flopHands = stats.inFlop;
          gameData.turnHands = stats.inTurn;
          gameData.riverHands = stats.inRiver;
          gameData.showdownHands = stats.wentToShowDown;
        }
      }
      if (game.dealerChoiceGames) {
        gameData.dealerChoiceGames = game.dealerChoiceGames.split(',');
      }
      if (game.roeGames) {
        gameData.roeGames = game.roeGames.split(',');
      }

      let runTime = 0;
      if (gameData.startedAt && gameData.endedAt) {
        const runTimeDiff =
          gameData.endedAt.getTime() - gameData.startedAt.getTime();
        runTime = Math.ceil(runTimeDiff / 1000);
      }
      gameData.runTime = runTime;
      completedGame = gameData;
      completedGames.push(completedGame);
    }
    const gamesById = _.keyBy(completedGames, 'gameId');
    const gameIds = Object.keys(gamesById);
    const playerInGame = await playerRepo.findOne({
      where: {
        gameId: In(gameIds),
        playerId: cachedPlayer.id,
      },
    });
    if (playerInGame) {
      if (playerInGame.buyIn) {
        if (gamesById[playerInGame.gameId]) {
          const game = gamesById[playerInGame.gameId];
          game.stack = playerInGame.stack;
          game.buyIn = playerInGame.buyIn;
          game.profit = playerInGame.stack - playerInGame.buyIn;
          game.handsPlayed = playerInGame.noHandsPlayed;
          game.sessionTime = playerInGame.sessionTime;
          game.stackStat = JSON.parse(playerInGame.handStack);
        }
      }
    }
    return completedGames;
  }

  public async getPlayersInGame(gameId: number): Promise<PlayersInGame[]> {
    const playersInGameRepo = await getHistoryRepository(PlayersInGame);
    const playersInGame = playersInGameRepo.find({ where: { gameId: gameId } });
    return playersInGame;
  }

  public async getCompletedGame(
    gameCode: string,
    playerId: number
  ): Promise<any> {
    const gameRepo = getHistoryRepository(GameHistory);
    const game = await gameRepo.findOne({ gameCode: gameCode });
    let completedGame: any;
    if (game) {
      let gameData: any = {
        gameId: game.gameId,
        gameCode: game.gameCode,
        gameNum: game.gameNum,
        status: game.status,
        smallBlind: game.smallBlind,
        bigBlind: game.bigBlind,
        highHandTracked: game.highHandTracked,
        gameType: game.gameType,
        startedAt: game.startedAt,
        startedBy: game.startedByName,
        endedAt: game.endedAt,
        endedBy: game.endedByName,
        handsDealt: game.handsDealt,
        dataAggregated: game.dataAggregated,
      };
      gameData.isHost = false;

      const cachedPlayer = await Cache.getPlayerById(playerId);
      const playerRepo = getHistoryRepository(PlayersInGame);
      const player = await playerRepo.findOne({
        gameId: game.gameId,
        playerId: playerId,
      });
      if (cachedPlayer) {
        if (game.startedBy === cachedPlayer.id) {
          gameData.isHost = true;
        }
        if (game.clubCode) {
          const clubMember = await ClubRepository.isClubMember(
            game.clubCode,
            cachedPlayer.uuid
          );
          if (clubMember) {
            gameData.isOwner = clubMember.isOwner;
            gameData.isManager = clubMember.isManager;
          }
        }
      }
      completedGame = gameData;

      if (player) {
        let balance: number | null = null;
        if (player.stack && player.buyIn) {
          balance = player.stack - player.buyIn;
          completedGame.stack = player.stack;
          completedGame.buyIn = player.buyIn;
          completedGame.profit = balance;
        }
      }
    }

    return completedGame;
  }

  public async getPastGames(playerId: string) {
    const player = await Cache.getPlayer(playerId);
    // get the list of past games associated with player clubs
    const playersRepo = getHistoryRepository(PlayersInGame);
    const playedGames = await playersRepo.find({
      where: {
        playerId: player.id,
      },
      order: {
        id: 'DESC',
      },
      take: 20,
    });
    if (playedGames.length === 0) {
      return [];
    }

    const gameRepo = getHistoryRepository(GameHistory);
    const pastGames = new Array<any>();
    const gameIds: Array<number> = playedGames.map(row => row.gameId);
    const res: Array<GameHistory> = await gameRepo.find({
      where: {
        gameId: In(gameIds),
        endedAt: Not(IsNull()),
      },
    });
    const gamesById = _.keyBy(res, 'gameId');

    for (const row of playedGames) {
      const game = gamesById[row.gameId];
      if (game) {
        let balance: number | null = null;
        if (row.buyIn && row.stack) {
          balance = row.stack - row.buyIn;
        }
        let sessionTime: number | null = row.sessionTime;
        if (sessionTime) {
          sessionTime = Math.ceil(sessionTime / 60);
        }

        let gameTime = Math.ceil(
          (game.endedAt.valueOf() - game.startedAt.valueOf()) / (60 * 1000)
        );

        const pastGame: any = {
          gameCode: game.gameCode,
          gameId: game.gameId,
          smallBlind: game.smallBlind,
          bigBlind: game.bigBlind,
          title: game.title,
          gameType: game.gameType,
          gameTime: gameTime,
          runTime: gameTime,
          startedBy: game.startedByName,
          startedAt: game.startedAt,
          endedBy: game.endedByName,
          endedAt: game.endedAt,
          maxPlayers: game.maxPlayers,
          highHandTracked: game.highHandTracked,
          handsDealt: game.handsDealt,
          handsPlayed: row.noHandsPlayed,
          playerStatus: row.status,
          sessionTime: sessionTime,
          buyIn: row.buyIn,
          stack: row.stack,
          balance: balance,
        };
        if (game.clubCode !== null && game.clubCode.length > 0) {
          const club = await Cache.getClub(game.clubCode);
          if (club) {
            pastGame.clubCode = club.clubCode;
            pastGame.clubName = club.name;
          }
        }
        if (game.dealerChoiceGames) {
          pastGame.dealerChoiceGames = game.dealerChoiceGames.split(',');
        }
        if (game.roeGames) {
          pastGame.roeGames = game.roeGames.split(',');
        }
        pastGames.push(pastGame);
      }
    }

    const orderedPastGames = _.orderBy(pastGames, ['endedAt'], ['desc']);
    return orderedPastGames;
  }

  public async getHistoryGame(
    gameCode: string
  ): Promise<GameHistory | undefined> {
    const gameRepo = getHistoryRepository(GameHistory);
    const game = await gameRepo.findOne({ gameCode: gameCode });
    return game;
  }

  public async getGameResultTable(gameCode: string): Promise<Array<any>> {
    const gameRepo = getHistoryRepository(GameHistory);
    const game = await gameRepo.findOne({ gameCode: gameCode });
    if (!game) {
      return [];
    }
    const gameResults = new Array<any>();
    const playersRepo = getHistoryRepository(PlayersInGame);
    const players = await playersRepo.find({ gameId: game.gameId });
    for (const player of players) {
      const gameResult = {
        sessionTime: player.sessionTime,
        sessionTimeStr: player.sessionTime.toString(),
        handsPlayed: player.noHandsPlayed,
        buyIn: player.buyIn,
        rakePaid: player.rakePaid,
        profit: player.stack - player.buyIn,
        stack: player.stack,
        playerName: player.playerName,
        playerId: player.id,
        playerUuid: player.playerUuid,
      };
      gameResults.push(gameResult);
    }
    return gameResults;
  }

  public async getCompletedGameByCode(
    gameCode: string
  ): Promise<GameHistory | undefined> {
    const gameHistoryRepo = getHistoryRepository(GameHistory);
    const game = await gameHistoryRepo.findOne({
      gameCode: gameCode,
    });
    return game;
  }

  public async didPlayInGame(gameCode: string, playerUuid: string) {
    const game = await this.getCompletedGameByCode(gameCode);
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }
    const playersRepo = getHistoryRepository(PlayersInGame);
    const player = await playersRepo.findOne({
      gameId: game.gameId,
      playerUuid: playerUuid,
    });
    if (player) {
      return true;
    }
    return false;
  }

  public async getGamePlayers(historyGame: GameHistory): Promise<Array<any>> {
    const playersRepo = getHistoryRepository(PlayersInGame);
    const players = await playersRepo.find({
      gameId: historyGame.gameId,
    });
    return players.map(x => {
      return {
        id: x.playerId,
        name: x.playerName,
        uuid: x.playerUuid,
      };
    });
  }
}

export const HistoryRepository = new HistoryRepositoryImpl();
