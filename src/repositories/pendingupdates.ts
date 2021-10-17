import {Not, EntityManager, Repository, getRepository, In} from 'typeorm';
import {fixQuery} from '@src/utils';
import {
  ApprovalStatus,
  GameStatus,
  GameType,
  NextHandUpdate,
  PlayerStatus,
  SeatStatus,
  TableStatus,
} from '@src/entity/types';
import {GameRepository} from './game';
import {getLogger} from '@src/utils/log';
import {
  NextHandUpdates,
  PokerGame,
  PokerGameSeatInfo,
  PokerGameUpdates,
} from '@src/entity/game/game';
import {PlayerGameTracker} from '@src/entity/game/player_game_tracker';
import {startTimer} from '@src/timer';
import {occupiedSeats, WaitListMgmt} from './waitlist';
import {SeatChangeProcess} from './seatchange';
import {DEALER_CHOICE_TIMEOUT, NewUpdate} from './types';
import _ from 'lodash';
import {Nats} from '@src/nats';
import {TakeBreak} from './takebreak';
import {Cache} from '@src/cache';
import {BuyIn} from './buyin';
import {reloadApprovalTimeoutExpired} from './timer';
import {Reload} from './reload';
import {getGameConnection, getGameManager, getGameRepository} from '.';
import {Player} from '@src/entity/player/player';
import {LocationCheck} from './locationcheck';
import {GameSettingsRepository} from './gamesettings';
import {resumeGame} from '@src/gameserver';
import {PlayersInGameRepository} from './playersingame';
import {GameUpdatesRepository} from './gameupdates';

const logger = getLogger('repositories::pendingupdates');

export async function markDealerChoiceNextHand(
  game: PokerGame,
  entityManager?: EntityManager
) {
  let nextHandUpdatesRepository;
  if (entityManager) {
    nextHandUpdatesRepository = entityManager.getRepository(NextHandUpdates);
  } else {
    nextHandUpdatesRepository = getGameRepository(NextHandUpdates);
  }
  const nextHandUpdate = new NextHandUpdates();
  nextHandUpdate.game = game;
  nextHandUpdate.newUpdate = NextHandUpdate.WAIT_FOR_DEALER_CHOICE;
  nextHandUpdatesRepository.save(nextHandUpdate);
}

export async function processPendingUpdates(gameId: number) {
  // this flag indicates whether we need to start seat change process or not
  // seat change is done, only if a player leaves, kicked out, or left due to connection issues
  let newOpenSeat = false;
  let dealerChoiceUpdate: NextHandUpdates | null = null;

  const gameRespository = getGameRepository(PokerGame);
  const game = await gameRespository.findOne({id: gameId});
  if (!game) {
    logger.error(`Game: ${gameId} is not found`);
    return;
  }
  logger.info(`[${game.log}] is processing pending updates`);
  await Cache.updateGamePendingUpdates(game?.gameCode, false);

  const gameSeatInfoRepo = getGameRepository(PokerGameSeatInfo);
  const gameSeatInfo = await gameSeatInfoRepo.findOne({gameID: game.id});
  if (!gameSeatInfo) {
    return;
  }

  const gameSettings = await GameSettingsRepository.get(game.gameCode);
  if (!gameSettings) {
    return;
  }

  if (gameSeatInfo.seatChangeInProgress) {
    logger.info(
      `[${game.log}] Seat change is in progress. No updates will be performed.`
    );
    return;
  }

  // if there is an end game update, let us end the game first
  const query = fixQuery(
    'SELECT COUNT(*) as updates FROM next_hand_updates WHERE game_id = ? AND new_update = ?'
  );
  let resp = await getGameConnection().query(query, [
    gameId,
    NextHandUpdate.END_GAME,
  ]);
  if (resp[0]['updates'] > 0) {
    const nextHandRepo = getGameRepository(NextHandUpdates);
    const update = await nextHandRepo.findOne({
      game: {id: gameId},
      newUpdate: NextHandUpdate.END_GAME,
    });
    const gameRepo = getGameRepository(PokerGame);
    const endedAt = new Date();
    const result = await gameRepo.update(
      {
        id: gameId,
      },
      {
        endedAt: endedAt,
        endedBy: update?.playerId,
        endedByName: update?.playerName,
      }
    );

    // game ended
    if (update) {
      await GameRepository.markGameEnded(gameId, update.endReason);
    }

    // delete hand updates for the game
    await getGameConnection().query(
      fixQuery('DELETE FROM next_hand_updates WHERE game_id=?'),
      [gameId]
    );
    return;
  }

  // did the host paused the game?
  resp = await getGameConnection().query(query, [
    gameId,
    NextHandUpdate.PAUSE_GAME,
  ]);
  if (resp[0]['updates'] > 0) {
    logger.info(`[${game.log}] game is paused`);
    // game paused
    await GameRepository.markGameStatus(gameId, GameStatus.PAUSED);

    // delete hand updates for the game
    await getGameConnection().query(
      fixQuery(
        'DELETE FROM next_hand_updates WHERE game_id=? AND new_update = ?'
      ),
      [gameId, NextHandUpdate.PAUSE_GAME]
    );
    return;
  }

  const pendingUpdatesRepo = getGameRepository(NextHandUpdates);
  const updates = await pendingUpdatesRepo.find({
    where: {
      game: {id: gameId},
    },
  });

  let endPendingProcess = true;
  let seatChangeInProgress = false;
  let openedSeat: number | undefined = 0;
  if (updates.length !== 0) {
    const playerGameTrackerRepository = getGameRepository(PlayerGameTracker);

    for (const update of updates) {
      // walk through each update
      if (update.newUpdate === NextHandUpdate.SWITCH_SEAT) {
        // switch player
        await switchSeat(
          playerGameTrackerRepository,
          game,
          update,
          pendingUpdatesRepo
        );
        newOpenSeat = true;
      } else if (update.newUpdate === NextHandUpdate.KICKOUT) {
        // kick out a player
        openedSeat = await kickoutPlayer(
          playerGameTrackerRepository,
          game,
          update,
          pendingUpdatesRepo
        );
        newOpenSeat = true;
      } else if (update.newUpdate === NextHandUpdate.LEAVE) {
        openedSeat = await leaveGame(
          playerGameTrackerRepository,
          game,
          update,
          pendingUpdatesRepo
        );
        newOpenSeat = true;
      } else if (update.newUpdate === NextHandUpdate.BUYIN_APPROVED) {
        await buyinApproved(
          playerGameTrackerRepository,
          game,
          update,
          pendingUpdatesRepo
        );
      } else if (update.newUpdate === NextHandUpdate.RELOAD_APPROVED) {
        await reloadApproved(game, update, pendingUpdatesRepo);
        continue;
      } else if (update.newUpdate === NextHandUpdate.WAIT_FOR_DEALER_CHOICE) {
        dealerChoiceUpdate = update;
      } else if (update.newUpdate === NextHandUpdate.TAKE_BREAK) {
        const player = await Cache.getPlayerById(update.playerId);
        const takeBreak = new TakeBreak(game, player);
        await takeBreak.processPendingUpdate(update);
      }
    }

    let seatChangeAllowed = gameSettings.seatChangeAllowed;
    seatChangeAllowed = true; // debugging
    if (seatChangeAllowed && openedSeat) {
      const seats = await occupiedSeats(game.id);
      if (newOpenSeat && seats <= game.maxPlayers - 1) {
        logger.info(`[${game.log}] Seat Change is in Progress`);
        // open seat
        const seatChangeProcess = new SeatChangeProcess(game);
        const waitingPlayers = await seatChangeProcess.getSeatChangeRequestedPlayers();
        if (waitingPlayers.length > 0) {
          endPendingProcess = false;
          await seatChangeProcess.start(openedSeat);
          seatChangeInProgress = true;
        }
      }
    }
  }

  if (!seatChangeInProgress && gameSettings.waitlistAllowed) {
    const waitlistMgmt = new WaitListMgmt(game);
    await waitlistMgmt.runWaitList();
  }

  if (endPendingProcess) {
    if (gameSettings.gpsCheck || gameSettings.ipCheck) {
      const locationCheck = new LocationCheck(game, gameSettings);
      await locationCheck.check();
    }

    // if the game does not have more than 1 active player, then the game cannot continue
    const canContinue = await GameRepository.determineGameStatus(game.id);
    if (!canContinue) {
      // Broadcast not enough players.
      await Nats.changeGameStatus(
        game,
        game.status,
        TableStatus.NOT_ENOUGH_PLAYERS
      );
      logger.info(`[${game.log}] does not have enough players`);
    }

    // start buy in timers for the player's whose stack is 0 and playing
    await BuyIn.startBuyInTimers(game);

    if (!canContinue) {
      return;
    }

    let promptDealerChoice = false;
    if (dealerChoiceUpdate) {
      promptDealerChoice = true;
    } else if (game.gameType === GameType.DEALER_CHOICE) {
      const update = await GameUpdatesRepository.get(game.gameCode, true);
      if (update.orbitPos === 0) {
        promptDealerChoice = true;
      }
    }
    if (promptDealerChoice) {
      await handleDealersChoice(game, dealerChoiceUpdate, pendingUpdatesRepo);
    } else {
      const cachedGame = await Cache.getGame(game.gameCode);
      await resumeGame(gameId);
    }
  }
}

async function kickoutPlayer(
  playerGameTrackerRepository: Repository<PlayerGameTracker>,
  game: PokerGame,
  update: NextHandUpdates,
  pendingUpdatesRepo: Repository<NextHandUpdates>
): Promise<number> {
  const playerInGame = await playerGameTrackerRepository.findOne({
    where: {
      game: {id: game.id},
      playerId: update.playerId,
    },
  });
  if (!playerInGame) {
    return 0;
  }
  const player = await Cache.getPlayerById(update.playerId);
  logger.info(
    `[${game.gameCode}] Player: ${player.uuid}/${player.name} is kicked out`
  );
  // calculate session time
  let sessionTime = playerInGame.sessionTime;
  const currentSessionTime =
    new Date().getTime() - playerInGame.satAt.getTime();
  const roundSeconds = Math.round(currentSessionTime / 1000);
  sessionTime = sessionTime + roundSeconds;

  await playerGameTrackerRepository.update(
    {
      game: {id: game.id},
      playerId: update.playerId,
    },
    {
      status: PlayerStatus.KICKED_OUT,
      sessionTime: sessionTime,
      seatNo: 0,
      satAt: undefined,
    }
  );

  // do updates that are necessary
  await GameRepository.seatOpened(game, playerInGame.seatNo);

  if (playerInGame) {
    Nats.playerKickedOut(game, player, playerInGame.seatNo);
  }
  // delete this update
  await pendingUpdatesRepo.delete({id: update.id});
  return playerInGame.seatNo;
}

async function switchSeat(
  playerGameTrackerRepository: Repository<PlayerGameTracker>,
  game: PokerGame,
  update: NextHandUpdates,
  pendingUpdatesRepo: Repository<NextHandUpdates>
) {
  const playerInGame = await playerGameTrackerRepository.findOne({
    where: {
      game: {id: game.id},
      playerId: update.playerId,
    },
  });
  if (!playerInGame) {
    return;
  }

  try {
    // old seat no
    const oldSeatNo = playerInGame.seatNo;
    const newSeatNo = update.newSeat;
    const player = await Cache.getPlayer(playerInGame.playerUuid);
    logger.info(
      `[${game.gameCode}] Player: ${player.uuid}/${player.name} is switching seat from ${oldSeatNo} to ${newSeatNo}`
    );

    await getGameManager().transaction(async transactionEntityManager => {
      const playerGameTrackerRepository = transactionEntityManager.getRepository(
        PlayerGameTracker
      );
      await playerGameTrackerRepository.update(
        {
          game: {id: game.id},
          playerId: update.playerId,
        },
        {
          seatNo: newSeatNo,
        }
      );
      playerInGame.seatNo = newSeatNo;

      // do updates that are necessary
      await GameRepository.seatOccupied(
        game,
        newSeatNo,
        transactionEntityManager
      );
      await GameRepository.seatOpened(
        game,
        oldSeatNo,
        transactionEntityManager
      );
      await Nats.notifyPlayerSwitchSeat(game, player, playerInGame, oldSeatNo);
    });
  } finally {
    // delete this update
    await pendingUpdatesRepo.delete({id: update.id});
  }
}

async function leaveGame(
  playerGameTrackerRepository: Repository<PlayerGameTracker>,
  game: PokerGame,
  update: NextHandUpdates,
  pendingUpdatesRepo: Repository<NextHandUpdates>
): Promise<number> {
  const playerInGame = await playerGameTrackerRepository.findOne({
    where: {
      game: {id: game.id},
      playerId: update.playerId,
    },
  });
  if (!playerInGame) {
    return 0;
  }
  const player = await Cache.getPlayerById(update.playerId);
  const openedSeat = playerInGame.seatNo;

  let sessionTime = playerInGame.sessionTime;

  if (playerInGame.satAt) {
    // calculate session time
    const satAt = new Date(Date.parse(playerInGame.satAt.toString()));
    const currentSessionTime = new Date().getTime() - satAt.getTime();
    const roundSeconds = Math.round(currentSessionTime / 1000);
    sessionTime = sessionTime + roundSeconds;
  }
  logger.info(
    `[${game.log}] ${player.uuid}/${player.name} left the game. Session time: ${sessionTime}`
  );

  await playerGameTrackerRepository.update(
    {
      game: {id: game.id},
      playerId: update.playerId,
    },
    {
      satAt: undefined,
      sessionTime: sessionTime,
      status: PlayerStatus.LEFT,
      seatNo: 0,
    }
  );

  // do updates that are necessary
  await GameRepository.seatOpened(game, openedSeat);

  if (playerInGame) {
    // notify game server, player is kicked out
    Nats.playerLeftGame(game, player, playerInGame.seatNo);
  }
  // delete this update
  await pendingUpdatesRepo.delete({id: update.id});
  return openedSeat;
}

async function buyinApproved(
  playerGameTrackerRepository: any,
  game: PokerGame,
  update: NextHandUpdates,
  pendingUpdatesRepo: Repository<NextHandUpdates>
) {
  let amount = 0;
  if (update.buyinAmount) {
    amount = update.buyinAmount;
  } else {
    amount = update.reloadAmount;
  }

  const playerInGame = await playerGameTrackerRepository.findOne({
    where: {
      game: {id: game.id},
      playerId: update.playerId,
    },
  });

  playerInGame.status = PlayerStatus.PLAYING;
  playerInGame.stack += amount;
  playerInGame.buyIn += amount;
  playerInGame.noOfBuyins += 1;
  await playerGameTrackerRepository.update(
    {
      game: {id: game.id},
      playerId: update.playerId,
    },
    {
      status: playerInGame.status,
      stack: playerInGame.stack,
      buyIn: playerInGame.buyIn,
      noOfBuyins: playerInGame.noOfBuyins,
    }
  );
  const player = await Cache.getPlayerById(update.playerId);
  logger.info(
    `[${game.log}] ${player.uuid}/${player.name} buyin is approved. Stack: ${playerInGame.stack} total buyin: ${playerInGame.buyIn}`
  );

  if (playerInGame) {
    // notify game server, player has a new buyin
    await Nats.playerBuyIn(game, player, playerInGame);
  }
  // delete this update
  await pendingUpdatesRepo.delete({id: update.id});
}

async function reloadApproved(
  game: PokerGame,
  update: NextHandUpdates,
  pendingUpdatesRepo: Repository<NextHandUpdates>
) {
  let amount = 0;
  if (update.buyinAmount) {
    amount = update.buyinAmount;
  } else {
    amount = update.reloadAmount;
  }
  // delete this update
  await pendingUpdatesRepo.delete({id: update.id});

  const player = await Cache.getPlayerById(update.playerId);
  const reload = new Reload(game, player);
  await reload.approvedAndUpdateStack(amount);
  logger.info(
    `[${game.log}] ${player.uuid}/${player.name} reload is approved. Amount: ${amount}`
  );
}

async function handleDealersChoice(
  game: PokerGame,
  update: NextHandUpdates | null,
  pendingUpdatesRepo: Repository<NextHandUpdates>
) {
  const dealerChoiceTimeout = new Date();
  const timeout = 10;
  dealerChoiceTimeout.setSeconds(
    dealerChoiceTimeout.getSeconds() + timeout + 1
  );

  // start a timer
  startTimer(game.id, 0, DEALER_CHOICE_TIMEOUT, dealerChoiceTimeout).catch(
    e => {
      logger.error(`Starting dealerchoice timeout failed. Error: ${e.message}`);
    }
  );

  // delete this update
  if (update) {
    await pendingUpdatesRepo.delete({id: update.id});
  }

  // get next player and send the notification
  const playersInSeats = await PlayersInGameRepository.getPlayersInSeats(
    game.id
  );
  const takenSeats = _.keyBy(playersInSeats, 'seatNo');
  const gameUpdate = await GameUpdatesRepository.get(game.gameCode, true);
  const occupiedSeats = new Array<number>();
  // dealer
  occupiedSeats.push(0);
  for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
    const playerSeat = takenSeats[seatNo];
    if (!playerSeat) {
      occupiedSeats.push(0);
    } else {
      if (playerSeat.status == PlayerStatus.PLAYING) {
        occupiedSeats.push(playerSeat.playerId);
      } else {
        occupiedSeats.push(0);
      }
    }
  }
  // determine button pos
  let buttonPos = gameUpdate.buttonPos;
  let playerId = 0;
  if (gameUpdate.handNum === 0 && occupiedSeats[buttonPos] !== 0) {
    playerId = occupiedSeats[buttonPos];
  } else {
    let maxPlayers = game.maxPlayers;
    while (maxPlayers > 0) {
      buttonPos++;
      if (buttonPos > maxPlayers) {
        buttonPos = 1;
      }
      if (occupiedSeats[buttonPos] !== 0) {
        playerId = occupiedSeats[buttonPos];
        break;
      }
      maxPlayers--;
    }
  }

  // let nextOrbit = buttonPos + 1;
  // if (nextOrbit > game.maxPlayers) {
  //   nextOrbit = 1;
  // }
  logger.info(
    `[${game.log}] DealerChoice: New dealer choice. Orbit ends at ${buttonPos}`
  );
  await GameUpdatesRepository.updateDealersChoiceSeat(
    game,
    playerId,
    gameUpdate.handNum + 1,
    buttonPos
  );
  const settings = await Cache.getGameSettings(game.gameCode);
  setTimeout(() => {
    Nats.sendDealersChoiceMessage(
      game,
      settings,
      playerId,
      gameUpdate.handNum + 1,
      timeout
    );
  }, 1000);
}

export async function switchSeatNextHand(
  game: PokerGame,
  player: Player,
  seatNo: number,
  transactionEntityManager?: EntityManager
) {
  let nextHandUpdatesRepository: Repository<NextHandUpdates>;
  const update = new NextHandUpdates();
  update.game = game;
  update.playerId = player.id;
  update.playerUuid = player.uuid;
  update.playerName = player.name;
  update.newUpdate = NextHandUpdate.SWITCH_SEAT;
  update.newSeat = seatNo;
  if (transactionEntityManager) {
    nextHandUpdatesRepository = transactionEntityManager.getRepository(
      NextHandUpdates
    );
    await nextHandUpdatesRepository.save(update);
    const gameSeatInfoProps: any = {};
    gameSeatInfoProps[`seat${seatNo}`] = SeatStatus.RESERVED;
    const gameSeatInfoRepo = transactionEntityManager.getRepository(
      PokerGameSeatInfo
    );
    await gameSeatInfoRepo.update(
      {
        gameID: game.id,
      },
      gameSeatInfoProps
    );
  } else {
    await getGameManager().transaction(async transactionEntityManager => {
      nextHandUpdatesRepository = transactionEntityManager.getRepository(
        NextHandUpdates
      );
      await nextHandUpdatesRepository.save(update);
      const gameSeatInfoRepo = transactionEntityManager.getRepository(
        PokerGameSeatInfo
      );
      const gameSeatInfoProps: any = {};
      gameSeatInfoProps[`seat${seatNo}`] = SeatStatus.RESERVED;
      await gameSeatInfoRepo.update(
        {
          gameID: game.id,
        },
        gameSeatInfoProps
      );
    });
  }
}
