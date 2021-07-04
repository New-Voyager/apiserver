import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {PokerGame, PokerGameUpdates} from '@src/entity/game/game';
import {GameHistory} from '@src/entity/history/game';
import {HighHandHistory} from '@src/entity/history/hand';
import {PlayersInGame} from '@src/entity/history/player';
import {HighHand} from '@src/entity/player/reward';
import {getManager, getRepository, getConnection} from 'typeorm';
import {fixQuery} from '@src/utils';
import {GameStatus} from '@src/entity/types';

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

  public async getCompletedGame(
    gameCode: string,
    playerId: number
  ): Promise<any> {
    const query = fixQuery(`
    SELECT pg.id, pg.game_code as "gameCode", pg.game_num as "gameNum",
    pig.session_time as "sessionTime",
    gh.small_blind as "smallBlind", gh.big_blind as "bigBlind",
    pig.no_hands_played as "handsPlayed", 
    pig.no_hands_won as "handsWon", pgs.in_flop as "flopHands", pgs.in_turn as "turnHands",
    pig.buy_in as "buyIn", (pig.stack - pig.buy_in) as "profit",
    pgs.in_preflop as "preflopHands", pgs.in_river as "riverHands", pgs.went_to_showdown as "showdownHands", 
    gh.game_type as "gameType", 
    gh.started_at as "startedAt",
    gh.ended_at as "endedAt", gh.ended_by_name as "endedBy", 
    gh.started_at as "startedAt", pig.session_time as "sessionTime", 
    pig.hands_dealt as "handsDealt"
    FROM
    game_history gh 
    LEFT OUTER JOIN players_in_game pig ON 
    pig.pig_game_id = gh.game_id AND pig.pig_player_id = ?
    LEFT OUTER JOIN player_game_stats pgs ON 
    pgs.game_id = pg.id AND pgs.player_id = pig.pig_player_id
    WHERE
    gh.game_code = ?
    `);

    // TODO: we need to do pagination here
    const result = await getConnection().query(query, [playerId, gameCode]);
    if (result.length > 0) {
      return result[0];
    }
    return null;
  }

  public async getPastGames(playerId: string) {
    // get the list of past games associated with player clubs
    const query = `
          SELECT 
            g.game_code as "gameCode", 
            g.game_id as gameId, 
            g.game_type as "gameType", 
            EXTRACT(EPOCH FROM(g.ended_at-g.started_at)) as "gameTime", 
            g.started_at as "startedAt", 
            g.ended_at as "endedAt",
            pig.session_time as "sessionTime",
            pig.buy_in as "buyIn",
            pig.stack as "stack",
          FROM game_history g JOIN poker_game_updates pgu ON 
          g.id = pgu.game_id 
            AND g.game_status = ${GameStatus.ENDED}
          LEFT OUTER JOIN 
            players_in_game pig ON
            pgt.pgt_game_id  = g.id
        `;
    const resp = await getConnection().query(query);
    return resp;
  }

  public async getGameResultTable(gameCode: string): Promise<any> {
    const query = fixQuery(`
      SELECT 
        pig.session_time AS "sessionTime",
        pig.no_hands_played AS "handsPlayed",
        pig.buy_in AS "buyIn",
        pig.stack - pig.buy_in AS "profit",
        pig.player_name AS "playerName",
        pig.player_uuid AS "playerId"
      FROM players_in_game pig
      INNER JOIN game_history gh ON pig.pig_game_id = gh.gameId
      WHERE gh.game_code = ?
      AND pig.no_hands_played > 0`);

    const result = await getConnection().query(query, [gameCode]);
    return result;
  }
}

export const HistoryRepository = new HistoryRepositoryImpl();
