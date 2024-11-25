import * as crypto from 'crypto';
import {
  EntityManager,
  getRepository,
  IsNull,
  Not,
  Repository,
  UpdateResult,
} from 'typeorm';
import { PlayerGameTracker } from '@src/entity/game/player_game_tracker';
import {
  getGameManager,
  getGameRepository,
  getHistoryRepository,
  getUserRepository,
} from '.';
import { errToStr, getLogger } from '@src/utils/log';
import {
  gameLogPrefix,
  NextHandUpdates,
  PokerGame,
  PokerGameSeatInfo,
  PokerGameSettings,
} from '@src/entity/game/game';
import { Player } from '@src/entity/player/player';
import { Cache } from '@src/cache';
import {
  CreditUpdateType,
  GameStatus,
  NextHandUpdate,
  PlayerStatus,
  TableStatus,
} from '@src/entity/types';
import { Nats } from '@src/nats';
import { startTimer } from '@src/timer';
import { centsToChips, chipsToCents, utcTime } from '@src/utils';
import _ from 'lodash';
import { BUYIN_TIMEOUT, GamePlayerSettings } from './types';
import { getAgoraToken } from '@src/3rdparty/agora';
import { HandHistory } from '@src/entity/history/hand';
import { ClubMember, ClubMemberStat } from '@src/entity/player/club';
import { StatsRepository } from './stats';
import { GameRepository } from './game';
import { TakeBreak } from './takebreak';
import { PlayersInGame } from '@src/entity/history/player';
import { Aggregation } from './aggregate';
import { ClubRepository } from './club';

const logger = getLogger('players_in_game');

class PlayersInGameRepositoryImpl {
  public async getPlayersInSeats(
    gameId: number,
    transactionManager?: EntityManager
  ): Promise<Array<PlayerGameTracker>> {
    let playerGameTrackerRepo: Repository<PlayerGameTracker>;
    if (transactionManager) {
      playerGameTrackerRepo =
        transactionManager.getRepository(PlayerGameTracker);
    } else {
      playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    }
    let resp = await playerGameTrackerRepo.find({
      game: { id: gameId },
      seatNo: Not(IsNull()),
    });
    resp = _.filter(resp, e => e.seatNo != 0);
    return resp;
  }

  public async getSeatInfo(
    gameId: number,
    seatNo: number,
    transactionManager?: EntityManager
  ): Promise<any> {
    let playerGameTrackerRepo;
    if (transactionManager) {
      playerGameTrackerRepo =
        transactionManager.getRepository(PlayerGameTracker);
    } else {
      playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    }
    logger.info('getSeatInfo');
    const resp = await playerGameTrackerRepo.findOne({
      game: { id: gameId },
      seatNo: seatNo,
    });
    return resp;
  }

  public async getPlayerInfo(
    game: PokerGame,
    player: Player,
    transactionManager?: EntityManager
  ): Promise<PlayerGameTracker> {
    let playerGameTrackerRepo;
    if (transactionManager) {
      playerGameTrackerRepo =
        transactionManager.getRepository(PlayerGameTracker);
    } else {
      playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    }
    const resp = await playerGameTrackerRepo.findOne({
      game: { id: game.id },
      playerId: player.id,
    });
    return resp;
  }

  public async getGamePlayerState(
    game: PokerGame,
    player: Player
  ): Promise<PlayerGameTracker | null> {
    //logger.info(`getGamePlayerState is called`);
    const repo = getGameRepository(PlayerGameTracker);
    const resp = await repo.find({
      playerId: player.id,
      game: { id: game.id },
    });
    if (resp.length === 0) {
      return null;
    }
    return resp[0];
  }

  public async kickOutPlayer(gameCode: string, player: Player) {
    await getGameManager().transaction(async transactionEntityManager => {
      // find game
      const game = await Cache.getGame(
        gameCode,
        false,
        transactionEntityManager
      );
      if (!game) {
        throw new Error(`Game ${gameCode} is not found`);
      }
      const playerGameTrackerRepository =
        transactionEntityManager.getRepository(PlayerGameTracker);
      logger.info(
        `Kick out player ${player?.id}/${player?.name} from game ${gameCode}`
      );
      const playerInGame = await playerGameTrackerRepository.findOne({
        where: {
          game: { id: game.id },
          playerId: player.id,
        },
      });

      if (!playerInGame) {
        // player is not in game
        throw new Error(`Player ${player.name} is not in the game`);
      }

      if (
        game.status === GameStatus.CONFIGURED ||
        game.status === GameStatus.PAUSED ||
        game.tableStatus !== TableStatus.GAME_RUNNING
      ) {
        // we can mark the user as KICKED_OUT from the player game tracker
        await playerGameTrackerRepository.update(
          {
            game: { id: game.id },
            playerId: player.id,
          },
          {
            seatNo: 0,
            status: PlayerStatus.KICKED_OUT,
          }
        );
        const count = await playerGameTrackerRepository.count({
          where: {
            game: { id: game.id },
            status: PlayerStatus.PLAYING,
          },
        });

        const gameSeatInfoRepo =
          transactionEntityManager.getRepository(PokerGameSeatInfo);
        await gameSeatInfoRepo.update(
          {
            gameID: game.id,
          },
          { playersInSeats: count }
        );
        Nats.playerKickedOut(game, player, playerInGame.seatNo);
      } else {
        // game is running, so kickout the user in next hand
        // deal with this in the next hand update
        const nextHandUpdatesRepository =
          transactionEntityManager.getRepository(NextHandUpdates);
        const update = new NextHandUpdates();
        update.game = game;
        update.playerId = player.id;
        update.playerUuid = player.uuid;
        update.playerName = player.name;
        update.newUpdate = NextHandUpdate.KICKOUT;
        await nextHandUpdatesRepository.save(update);
      }
    });
  }

  public async sitOutPlayer(gameCode: string, player: Player) {
    // find game
    const game = await Cache.getGame(gameCode, false);

    if (game) {
      const takeBreak = new TakeBreak(game, player);
      const status = await takeBreak.takeBreak();
    }
  }

  public async setBuyInLimit(gameCode: string, player: Player, cents: number) {
    await getGameManager().transaction(async transactionEntityManager => {
      // find game
      const game = await Cache.getGame(
        gameCode,
        false,
        transactionEntityManager
      );
      if (!game) {
        throw new Error(`Game ${gameCode} is not found`);
      }
      const playerGameTrackerRepository =
        transactionEntityManager.getRepository(PlayerGameTracker);
      logger.info(
        `Setting buy-in limit to ${cents} cents for player ${player?.id}/${player?.name} in game ${gameCode}`
      );
      const playerInGame = await playerGameTrackerRepository.findOne({
        where: {
          game: { id: game.id },
          playerId: player.id,
        },
      });

      if (!playerInGame) {
        // player is not in game
        throw new Error(`Player ${player.name} is not in the game`);
      }

      await playerGameTrackerRepository.update(
        {
          game: { id: game.id },
          playerId: player.id,
        },
        {
          buyInAutoApprovalLimit: cents,
        }
      );
    });
  }

  public async assignNewHost(
    gameCode: string,
    oldHostPlayer: Player,
    newHostPlayer: Player
  ) {
    await getGameManager().transaction(async transactionEntityManager => {
      // find game
      const game = await Cache.getGame(
        gameCode,
        false,
        transactionEntityManager
      );
      if (!game) {
        throw new Error(`Game ${gameCode} is not found`);
      }

      // Only one of the seated players can be assigned as the new host.
      const playersInSeats: Array<PlayerGameTracker> =
        await this.getPlayersInSeats(game.id, transactionEntityManager);
      let isPlayerInSeat: boolean = false;
      for (const p of playersInSeats) {
        if (p.playerId === newHostPlayer.id) {
          isPlayerInSeat = true;
        }
      }
      if (!isPlayerInSeat) {
        throw new Error(
          `Player ${newHostPlayer.uuid} is not in seat in game ${gameCode}`
        );
      }

      const gameRepo = transactionEntityManager.getRepository(PokerGame);
      await gameRepo.update(
        {
          gameCode: gameCode,
        },
        {
          hostId: newHostPlayer.id,
          hostUuid: newHostPlayer.uuid,
          hostName: newHostPlayer.name,
        }
      );
      await Cache.getGame(
        gameCode,
        true /** update */,
        transactionEntityManager
      );
      Nats.hostChanged(game, newHostPlayer);
    });
  }

  public async getAudioToken(
    player: Player,
    game: PokerGame,
    transactionEntityManager?: EntityManager
  ): Promise<string> {
    logger.info(`getAudioToken is called`);
    let playerGameTrackerRepository: Repository<PlayerGameTracker>;
    if (transactionEntityManager) {
      playerGameTrackerRepository =
        transactionEntityManager.getRepository(PlayerGameTracker);
    } else {
      playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    }
    const rows = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: { id: game.id },
        playerId: player.id,
      })
      .select('audio_token')
      .addSelect('status')
      .execute();
    if (!rows && rows.length === 0) {
      throw new Error('Player is not found in the game');
    }
    let token;
    if (rows && rows.length >= 1) {
      const playerInGame = rows[0];
      token = playerInGame.audio_token;
    }

    // TODO: agora will be used only for the player who are in the seats
    // if the player is not playing, then the player cannot join
    // if (playerInGame.status !== PlayerStatus.PLAYING) {
    //   return '';
    // }

    if (!token) {
      token = await getAgoraToken(game.gameCode, player.id);

      if (rows && rows.length === 1) {
        // update the record
        await playerGameTrackerRepository.update(
          {
            game: { id: game.id },
            playerId: player.id,
          },
          {
            audioToken: token,
          }
        );
      }
    }

    return token;
  }

  public async updatePlayerGameSettings(
    player: Player,
    game: PokerGame,
    config: GamePlayerSettings
  ): Promise<boolean> {
    await getGameManager().transaction(async transactionEntityManager => {
      //logger.info(`updatePlayerConfig is called`);
      const updates: PlayerGameTracker = new PlayerGameTracker();
      if (config.muckLosingHand !== undefined) {
        updates.muckLosingHand = config.muckLosingHand;
      }
      if (config.runItTwiceEnabled !== undefined) {
        updates.runItTwiceEnabled = config.runItTwiceEnabled;
      }
      if (config.autoStraddle !== undefined) {
        updates.autoStraddle = config.autoStraddle;
      }
      if (config.buttonStraddle !== undefined) {
        updates.buttonStraddle = config.buttonStraddle;

        if (updates.buttonStraddle) {
          if (config.buttonStraddleBet) {
            updates.buttonStraddleBet = config.buttonStraddleBet;
          } else {
            // 2 times big blind
            config.buttonStraddleBet = 2;
          }
        }
      }
      if (config.bombPotEnabled !== undefined) {
        updates.bombPotEnabled = config.bombPotEnabled;
      }

      const playerGameTrackerRepo =
        transactionEntityManager.getRepository(PlayerGameTracker);
      logger.info(
        `Updating player game settings for player ${player?.id}/${player?.name} game ${game?.gameCode}`
      );

      const row = await playerGameTrackerRepo.findOne({
        game: { id: game.id },
        playerId: player.id,
      });
      const updatesObject: any = updates as any;
      if (row !== null) {
        await playerGameTrackerRepo.update(
          {
            game: { id: game.id },
            playerId: player.id,
          },
          updatesObject
        );
      } else {
        // create a row
        updates.game = game;
        updates.playerId = player.id;
        updates.playerUuid = player.uuid;
        updates.playerName = player.name;
        updates.status = PlayerStatus.NOT_PLAYING;
        updates.buyIn = 0;
        updates.stack = 0;
        await playerGameTrackerRepo.save(updates);
      }
    });
    return true;
  }

  public async getPlayerGameSettings(
    player: Player,
    game: PokerGame
  ): Promise<GamePlayerSettings> {
    const playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    const playerInGame = await playerGameTrackerRepo.findOne({
      game: { id: game.id },
      playerId: player.id,
    });
    if (!playerInGame) {
      return {
        muckLosingHand: false,
        autoStraddle: false,
        bombPotEnabled: true,
        runItTwiceEnabled: true,
        buttonStraddle: false,
        autoReload: false,
        reloadThreshold: centsToChips(game.buyInMin),
        reloadTo: centsToChips(game.buyInMax),
      };
    }

    let reloadLowThreshold = playerInGame.reloadLowThreshold;
    let reloadTo = playerInGame.reloadTo;
    if (!reloadLowThreshold) {
      reloadLowThreshold = game.buyInMin;
    }
    if (!reloadTo) {
      reloadTo = game.buyInMax;
    }

    const settings: GamePlayerSettings = {
      muckLosingHand: playerInGame.muckLosingHand,
      autoStraddle: playerInGame.autoStraddle,
      bombPotEnabled: playerInGame.bombPotEnabled,
      runItTwiceEnabled: playerInGame.runItTwiceEnabled,
      buttonStraddle: playerInGame.buttonStraddle,
      autoReload: playerInGame.autoReload,
      reloadThreshold: centsToChips(reloadLowThreshold),
      reloadTo: centsToChips(reloadTo),
    };
    return settings;
  }

  public async startBuyinTimer(
    game: PokerGame,
    playerId: number,
    playerName: string,
    props?: any,
    transactionEntityManager?: EntityManager
  ) {
    logger.debug(
      `[${game.gameCode}] Starting buyin timer for player: ${playerName}`
    );
    let playerGameTrackerRepository: Repository<PlayerGameTracker>;

    if (transactionEntityManager) {
      playerGameTrackerRepository =
        transactionEntityManager.getRepository(PlayerGameTracker);
    } else {
      playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    }
    // TODO: start a buy-in timer
    let gameSettingsRepo: Repository<PokerGameSettings>;
    if (transactionEntityManager) {
      gameSettingsRepo =
        transactionEntityManager.getRepository(PokerGameSettings);
    } else {
      gameSettingsRepo = getGameRepository(PokerGameSettings);
    }
    const gameSettings = await gameSettingsRepo.findOne({
      gameCode: game.gameCode,
    });
    let timeout = 60;
    if (gameSettings) {
      timeout = gameSettings.buyInTimeout;
    }
    const buyinTimeExp = new Date();
    buyinTimeExp.setSeconds(buyinTimeExp.getSeconds() + timeout);
    const exp = utcTime(buyinTimeExp);
    let setProps: any = {};
    if (props) {
      setProps = _.merge(setProps, props);
    }
    setProps.buyInExpAt = exp;
    await playerGameTrackerRepository.update(
      {
        game: { id: game.id },
        playerId: playerId,
      },
      setProps
    );

    startTimer(game.id, playerId, BUYIN_TIMEOUT, buyinTimeExp).catch(e => {
      logger.error(`Starting buyin timeout failed. Error: ${e.message}`);
    });
  }

  public async resetNextHand(
    game: PokerGame,
    transactionEntityManager: EntityManager
  ) {
    const repo = transactionEntityManager.getRepository(PlayerGameTracker);
    await repo.update(
      {
        postedBlindNextHand: false,
        inHandNextHand: false,
      },
      {
        game: { id: game.id },
      }
    );
  }

  public async gameEnded(
    game: PokerGame,
    transactionEntityManager?: EntityManager
  ) {
    try {
      let playerGameRepo: Repository<PlayerGameTracker>;
      if (transactionEntityManager) {
        playerGameRepo =
          transactionEntityManager.getRepository(PlayerGameTracker);
      } else {
        playerGameRepo = getGameRepository(PlayerGameTracker);
      }
      // update session time
      const playerInGame = await playerGameRepo.find({
        game: { id: game.id },
      });
      // walk through the hand history and collect big win hands for each player
      const playerBigWinLoss = {};
      const hands = await getHistoryRepository(HandHistory).find({
        where: { gameId: game.id },
        order: { handNum: 'ASC' },
      });

      // determine big win/loss hands
      for (const hand of hands) {
        const playerStacks = JSON.parse(hand.playersStack);
        for (const playerId of Object.keys(playerStacks)) {
          const playerStack = playerStacks[playerId];
          const diff = playerStack.after - playerStack.before;
          if (!playerBigWinLoss[playerId]) {
            playerBigWinLoss[playerId] = {
              playerId: playerId,
              bigWin: 0,
              bigLoss: 0,
              bigWinHand: 0,
              bigLossHand: 0,
              playerStack: [],
            };
          }

          if (diff > 0 && diff > playerBigWinLoss[playerId].bigWin) {
            playerBigWinLoss[playerId].bigWin = diff;
            playerBigWinLoss[playerId].bigWinHand = hand.handNum;
          }

          if (diff < 0 && diff < playerBigWinLoss[playerId].bigLoss) {
            playerBigWinLoss[playerId].bigLoss = diff;
            playerBigWinLoss[playerId].bigLossHand = hand.handNum;
          }
          // gather player stack from each hand
          playerBigWinLoss[playerId].playerStack.push({
            hand: hand.handNum,
            playerStack,
          });
        }
      }

      const chipUpdates = new Array<Promise<UpdateResult>>();
      for (const playerIdStr of Object.keys(playerBigWinLoss)) {
        const playerId = parseInt(playerIdStr);
        const result = await playerGameRepo.update(
          {
            playerId: playerId,
            game: { id: game.id },
          },
          {
            bigWin: playerBigWinLoss[playerIdStr].bigWin,
            bigWinHand: playerBigWinLoss[playerIdStr].bigWinHand,
            bigLoss: playerBigWinLoss[playerIdStr].bigLoss,
            bigLossHand: playerBigWinLoss[playerIdStr].bigLossHand,
            handStack: JSON.stringify(
              playerBigWinLoss[playerIdStr].playerStack
            ),
          }
        );
        //logger.info(JSON.stringify(result));
      }

      if (game.clubCode) {
        // update club member balance
        const playerChips = await playerGameRepo.find({
          where: { game: { id: game.id } },
        });

        for (const playerChip of playerChips) {
          const clubPlayerStats = getUserRepository(ClubMemberStat)
            .createQueryBuilder()
            .update()
            .set({
              totalBuyins: () => `total_buyins + ${playerChip.buyIn}`,
              totalWinnings: () =>
                `total_winnings + ${playerChip.stack - playerChip.buyIn}`,
              rakePaid: () => `rake_paid + ${playerChip.rakePaid}`,
              totalGames: () => 'total_games + 1',
              totalHands: () => `total_hands + ${playerChip.noHandsPlayed}`,
            })
            .where({
              playerId: playerChip.playerId,
              clubId: game.clubId,
            })
            .execute();
          chipUpdates.push(clubPlayerStats);
        }
      }
      await Promise.all(chipUpdates);
    } catch (err) {
      logger.error(`[${game.gameCode}] Failed to update players in game stats`);
    }
  }

  public async openSeats(game: PokerGame): Promise<Array<number>> {
    const playersInSeats = await this.getPlayersInSeats(game.id);
    const takenSeats = playersInSeats.map(x => x.seatNo);
    const availableSeats: Array<number> = [];
    for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
      if (takenSeats.indexOf(seatNo) === -1) {
        availableSeats.push(seatNo);
      }
    }
    return availableSeats;
  }

  public async seatPlayer(
    game: PokerGame,
    gameSettings: PokerGameSettings,
    player: Player,
    seatNo: number,
    ip: string,
    location: any,
    waitlistPlayer: boolean,
    entityManager: EntityManager | undefined
  ): Promise<PlayerGameTracker> {
    let playerGameTrackerRepository: Repository<PlayerGameTracker>;
    if (entityManager) {
      playerGameTrackerRepository =
        entityManager.getRepository(PlayerGameTracker);
    } else {
      playerGameTrackerRepository = getGameRepository(PlayerGameTracker);
    }
    // if this player has already played this game before, we should have his record
    let playerInGame = await playerGameTrackerRepository.findOne({
      game: { id: game.id },
      playerId: player.id,
      active: true,
    });
    let newPlayer = false;
    let considerNewBuyin = false;
    if (playerInGame) {
      // if (playerInGame.status != PlayerStatus.IN_BREAK) {
      // }
      if (playerInGame.creditsSettled) {
        considerNewBuyin = true;
      }

      playerInGame.seatNo = seatNo;
      playerInGame.playerIp = ip;
      if (location) {
        playerInGame.playerLocation = `${location.lat},${location.long}`;
      }
      if (playerInGame.noHandsPlayed == 0) {
        newPlayer = true;
      }
    } else {
      playerInGame = new PlayerGameTracker();
      playerInGame.playerId = player.id;
      playerInGame.playerUuid = player.uuid;
      playerInGame.playerName = player.name;
      playerInGame.game = game;
      playerInGame.stack = 0;
      playerInGame.buyIn = 0;
      playerInGame.seatNo = seatNo;
      playerInGame.noOfBuyins = 0;
      playerInGame.buyinNotes = '';
      playerInGame.satAt = new Date();
      const randomBytes = Buffer.from(crypto.randomBytes(5));
      playerInGame.gameToken = randomBytes.toString('hex');
      playerInGame.status = PlayerStatus.NOT_PLAYING;
      playerInGame.runItTwiceEnabled = gameSettings.runItTwiceAllowed;
      playerInGame.muckLosingHand = game.muckLosingHand;
      playerInGame.playerIp = ip;
      playerInGame.sessionStartTime = new Date(Date.now());
      playerInGame.sessionNo = 1;
      playerInGame.active = true;

      if (location) {
        playerInGame.playerLocation = `${location.lat},${location.long}`;
      }

      if (
        game.status === GameStatus.ACTIVE &&
        game.tableStatus === TableStatus.GAME_RUNNING
      ) {
        // player must post blind
        playerInGame.missedBlind = true;
      }

      try {
        if (gameSettings.useAgora) {
          playerInGame.audioToken = await PlayersInGameRepository.getAudioToken(
            player,
            game,
            entityManager
          );
        }
      } catch (err) {
        logger.error(
          `Failed to get agora token ${errToStr(err)} Game: ${game.id}`
        );
      }
      try {
        await playerGameTrackerRepository.save(playerInGame);
      } catch (err) {
        logger.error(
          `Failed to update player_game_tracker and player_game_stats table ${errToStr(
            err
          )} Game: ${game.id}`
        );
        throw err;
      }
      newPlayer = true;
    }

    if (newPlayer) {
      try {
        await StatsRepository.joinedNewGame(player);
        // create a row in stats table
        await StatsRepository.newGameStatsRow(game, player);
      } catch (err) {
        logger.error(
          `Failed to update player_game_tracker and player_game_stats table ${errToStr(
            err
          )} Game: ${game.id}`
        );
        throw err;
      }
    }

    // we need 5 bytes to scramble 5 cards
    if (playerInGame.stack > game.ante) {
      playerInGame.status = PlayerStatus.PLAYING;
    } else {
      playerInGame.status = PlayerStatus.WAIT_FOR_BUYIN;
    }

    await playerGameTrackerRepository.update(
      {
        game: { id: game.id },
        playerId: player.id,
        active: true
      },
      {
        seatNo: seatNo,
        status: playerInGame.status,
        waitingFrom: null,
        waitlistNum: 0,
        satAt: new Date(),
      }
    );
    await GameRepository.seatOccupied(game, seatNo, entityManager);
    if (playerInGame.status === PlayerStatus.WAIT_FOR_BUYIN) {
      await PlayersInGameRepository.startBuyinTimer(
        game,
        player.id,
        player.name,
        {},
        entityManager
      );
    }
    try {
      if (game.clubCode) {
        const clubMember = await Cache.getClubMember(
          player.uuid,
          game.clubCode
        );
        if (clubMember) {
          const clubMemberRepo = getUserRepository(ClubMember);
          await clubMemberRepo.update(
            {
              id: clubMember.id,
            },
            {
              lastPlayedDate: new Date(),
            }
          );
        }

        if (considerNewBuyin) {
          // update credit history
          await ClubRepository.updateCreditAndTracker(
            player,
            game.clubCode,
            -playerInGame.stack,
            CreditUpdateType.BUYIN,
            game.gameCode
          );
        }
      }
    } catch (err) {
      // ignore this error (not critical)
    }
    await Cache.removeGameObserver(game.gameCode, player);
    // send a message to gameserver
    //newPlayerSat(game, player, seatNo, playerInGame);
    Nats.newPlayerSat(game, player, playerInGame, seatNo);

    if (playerInGame.status === PlayerStatus.PLAYING) {
      await GameRepository.restartGameIfNeeded(
        game,
        true,
        false,
        entityManager
      );
    }
    const updatedPlayer = await playerGameTrackerRepository.findOne({
      game: { id: game.id },
      playerId: player.id,
    });
    if (!updatedPlayer) {
      throw new Error('Could not find player');
    }
    return updatedPlayer;
  }

  public async getPlayersInGameById(
    gameId: number
  ): Promise<Array<PlayersInGame> | undefined> {
    const playersInGameRepo = getHistoryRepository(PlayersInGame);
    const playersInGame = await playersInGameRepo.find({
      where: { gameId: gameId },
    });
    return playersInGame;
  }

  public async getPlayersGameTrackerById(
    gameId: number
  ): Promise<Array<PlayerGameTracker> | undefined> {
    const playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    const playerGameTracker = await playerGameTrackerRepo.find({
      where: { game: { id: gameId } },
    });
    return playerGameTracker;
  }

  public async postBlind(game: PokerGame, player: Player): Promise<void> {
    logger.info(`postBlind is called`);
    const playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    const playerGameTracker = await playerGameTrackerRepo.findOne({
      where: {
        game: { id: game.id },
        playerId: player.id,
      },
    });
    if (playerGameTracker) {
      await playerGameTrackerRepo.update(
        {
          game: { id: game.id },
          playerId: player.id,
        },
        {
          postedBlind: true,
        }
      );
    }
    const gameDB = await Cache.getGame(game.gameCode, true);
    if (gameDB && gameDB.tableStatus === TableStatus.NOT_ENOUGH_PLAYERS) {
      // resume game
      await GameRepository.restartGameIfNeeded(game, false, false);
    }
  }

  public async autoReload(
    game: PokerGame,
    player: Player,
    reloadThreshold: number,
    reloadTo: number
  ): Promise<void> {
    logger.info(`auto reload is called`);
    const playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    const playerGameTracker = await playerGameTrackerRepo.findOne({
      where: {
        game: { id: game.id },
        playerId: player.id,
      },
    });
    if (playerGameTracker) {
      await playerGameTrackerRepo.update(
        {
          game: { id: game.id },
          playerId: player.id,
        },
        {
          autoReload: true,
          reloadLowThreshold: reloadThreshold,
          reloadTo: reloadTo,
        }
      );
      await Cache.getAutoReloadPlayers(game.id, true);
    }
  }

  public async autoReloadOff(game: PokerGame, player: Player): Promise<void> {
    const playerGameTrackerRepo = getGameRepository(PlayerGameTracker);
    const playerGameTracker = await playerGameTrackerRepo.findOne({
      where: {
        game: { id: game.id },
        playerId: player.id,
      },
    });
    if (playerGameTracker) {
      await playerGameTrackerRepo.update(
        {
          game: { id: game.id },
          playerId: player.id,
        },
        {
          autoReload: false,
        }
      );
      await Cache.getAutoReloadPlayers(game.id, true);
    }
  }

  public async leaveGame(
    playerGameTrackerRepository: Repository<PlayerGameTracker>,
    game: PokerGame,
    playerId: number,
  ): Promise<number> {

    const playerInGame = await playerGameTrackerRepository.findOne({
      where: {
        game: { id: game.id },
        playerId: playerId,
        active: true,
      },
    });
    if (!playerInGame) {
      return 0;
    }
    logger.error(`[${gameLogPrefix(game)}] Player ${playerInGame.playerName} (${playerInGame.playerId}) is left the session: ${playerInGame.sessionNo}`);
    const player = await Cache.getPlayerById(playerId);
    const openedSeat = playerInGame.seatNo;

    let sessionTime = playerInGame.sessionTime;

    if (playerInGame.sessionStartTime) {
      // calculate session time
      const satAt = new Date(Date.parse(playerInGame.sessionStartTime.toString()));
      const currentSessionTime = new Date().getTime() - satAt.getTime();
      const roundSeconds = Math.round(currentSessionTime / 1000);
      sessionTime = sessionTime + roundSeconds;
    }
    logger.info(
      `[${gameLogPrefix(game)}] ${player.uuid}/${player.name
      } left the game. Session time: ${sessionTime}`
    );


    let settled = false;
    // update club credits
    if (game.clubCode) {
      if (game.status === GameStatus.ACTIVE) {
        try {
          await Aggregation.settlePlayerCredits(game, playerInGame);
          settled = true;
        } catch (err) {
          logger.error(`[${gameLogPrefix(game)}] Failed to settle credits for player: ${playerInGame.playerName} (${playerInGame.playerId})`);
        }
      }
    }

    await playerGameTrackerRepository.update(
      {
        game: { id: game.id },
        playerId: playerId,
        active: true,
      },
      {
        satAt: undefined,
        sessionTime: sessionTime,
        sessionLeftTime: new Date(Date.now()),
        status: PlayerStatus.LEFT,
        seatNo: 0,
        creditsSettled: settled,
      }
    );
    // do updates that are necessary
    await GameRepository.seatOpened(game, openedSeat);

    if (playerInGame) {
      // notify game server, player is kicked out
      Nats.playerLeftGame(game, player, playerInGame.seatNo);
    }
    return openedSeat;
  }

  public async disconnectedFromGame(
    game: PokerGame,
    player: Player,
  ): Promise<boolean> {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);

    await playerGameTrackerRepository
      .createQueryBuilder()
      .update()
      .set({
        disconnectCount: () => 'disconnect_count + 1',
      })
      .where({
        game: { id: game.id },
        playerId: player.id,
      })
      .execute();

    // update history table as well

    return true;
  }

  public async refreshGame(
    game: PokerGame,
    player: Player,
  ): Promise<boolean> {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);

    await playerGameTrackerRepository
      .createQueryBuilder()
      .update()
      .set({
        refreshCount: () => 'refresh_count + 1',
      })
      .where({
        game: { id: game.id },
        playerId: player.id,
      })
      .execute();
    return true;
  }
}

export const PlayersInGameRepository = new PlayersInGameRepositoryImpl();
