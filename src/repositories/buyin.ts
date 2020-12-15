import {getConnection, getManager, getRepository} from 'typeorm';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache';
import {Player} from '@src/entity/player';
import {NextHandUpdates, PokerGame, PokerGameUpdates} from '@src/entity/game';
import {
  BuyInApprovalStatus,
  GameStatus,
  NextHandUpdate,
  PlayerStatus,
  TableStatus,
} from '@src/entity/types';
import {PlayerGameTracker} from '@src/entity/chipstrack';
import {GameRepository} from './game';
import {playerBuyIn} from '@src/gameserver';

const logger = getLogger('buyin');

export async function buyInRequest(
  player: Player,
  game: PokerGame,
  amount: number
): Promise<PlayerStatus> {
  const status = await getManager().transaction(async () => {
    // player must be already in a seat or waiting list
    // if credit limit is set, make sure his buyin amount is within the credit limit
    // if auto approval is set, add the buyin
    // make sure buyin within min and maxBuyin
    // send a message to game server that buyer stack has been updated
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const playerInGames = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: game.id},
        player: {id: player.id},
      })
      .select('stack')
      .addSelect('status')
      .addSelect('no_of_buyins', 'noOfBuyins')
      .addSelect('seat_no', 'seatNo')
      .addSelect('buy_in', 'buyIn')
      .execute();

    const playerInGame = playerInGames[0];
    if (!playerInGame) {
      logger.error(
        `Player ${player.uuid} is not in the game: ${game.gameCode}`
      );
      throw new Error(`Player ${player.uuid} is not in the game`);
    }

    // check amount should be between game.minBuyIn and game.maxBuyIn
    if (
      playerInGame.stack + amount < game.buyInMin ||
      playerInGame.stack + amount > game.buyInMax
    ) {
      throw new Error(
        `Buyin must be between ${game.buyInMin} and ${game.buyInMax}`
      );
    }

    // NOTE TO SANJAY: Add other functionalities
    const clubMember = await Cache.getClubMember(
      player.uuid,
      game.club.clubCode
    );
    if (!clubMember) {
      throw new Error(`The player ${player.uuid} is not in the club`);
    }

    if (clubMember.autoBuyinApproval) {
      if (
        game.status === GameStatus.ACTIVE &&
        game.tableStatus === TableStatus.GAME_RUNNING
      ) {
        // add buyin to next hand update
        await addBuyInToNextHand(
          player,
          game,
          amount,
          NextHandUpdate.BUYIN_APPROVED
        );
        playerInGame.status = PlayerStatus.PENDING_UPDATES;
      } else {
        playerInGame.noOfBuyins++;
        playerInGame.stack += amount;
        playerInGame.buyIn += amount;
        // if the player is in the seat and waiting for buyin
        // then mark his status as playing
        if (
          playerInGame.seatNo !== 0 &&
          playerInGame.status === PlayerStatus.WAIT_FOR_BUYIN
        ) {
          playerInGame.status = PlayerStatus.PLAYING;
        }
      }
    } else {
      const query =
        'SELECT SUM(buy_in) current_buyin FROM player_game_tracker pgt, poker_game pg WHERE pgt.pgt_player_id = ' +
        player.id +
        ' AND pgt.pgt_game_id = pg.id AND pg.game_status =' +
        GameStatus.ENDED;
      const resp = await getConnection().query(query);

      const currentBuyin = resp[0]['current_buyin'];

      let outstandingBalance = playerInGame.buyIn;
      if (currentBuyin) {
        outstandingBalance += currentBuyin;
      }

      let availableCredit = 0.0;
      if (clubMember.creditLimit >= 0) {
        availableCredit = clubMember.creditLimit - outstandingBalance;
      }

      if (amount <= availableCredit) {
        if (
          game.status === GameStatus.ACTIVE &&
          game.tableStatus === TableStatus.GAME_RUNNING
        ) {
          // add buyin to next hand update
          await addBuyInToNextHand(
            player,
            game,
            amount,
            NextHandUpdate.BUYIN_APPROVED
          );
          playerInGame.status = PlayerStatus.PENDING_UPDATES;
        } else {
          // player is within the credit limit
          playerInGame.noOfBuyins++;
          playerInGame.stack += amount;
          playerInGame.buyIn += amount;

          // if the player is in the seat and waiting for buyin
          // then mark his status as playing
          if (
            playerInGame.seatNo !== 0 &&
            playerInGame.status === PlayerStatus.WAIT_FOR_BUYIN
          ) {
            playerInGame.status = PlayerStatus.PLAYING;
          }
        }
      } else {
        await addBuyInToNextHand(
          player,
          game,
          amount,
          NextHandUpdate.WAIT_BUYIN_APPROVAL
        );
        playerInGame.status = PlayerStatus.PENDING_UPDATES;
      }
    }

    await playerGameTrackerRepository
      .createQueryBuilder()
      .update()
      .set({
        noOfBuyins: playerInGame.noOfBuyins,
        stack: playerInGame.stack,
        buyIn: playerInGame.buyIn,
        status: playerInGame.status,
      })
      .where({
        game: {id: game.id},
        player: {id: player.id},
      })
      .execute();

    const count = await playerGameTrackerRepository
      .createQueryBuilder()
      .where({
        game: {id: game.id},
        status: PlayerStatus.PLAYING,
      })
      .getCount();

    const gameUpdatesRepo = getRepository(PokerGameUpdates);
    await gameUpdatesRepo
      .createQueryBuilder()
      .update({
        playersInSeats: count,
      })
      .where({
        gameID: game.id,
      })
      .execute();

    // send a message to gameserver
    // get game server of this game
    const gameServer = await GameRepository.getGameServer(game.id);
    if (gameServer) {
      playerBuyIn(game, player, playerInGame);
    }

    return playerInGame.status;
  });
  return status;
}

async function addBuyInToNextHand(
  player: Player,
  game: PokerGame,
  amount: number,
  status: NextHandUpdate
) {
  const nextHandUpdatesRepository = getRepository(NextHandUpdates);
  const update = new NextHandUpdates();
  update.game = game;
  update.player = player;
  update.newUpdate = status;
  update.buyinAmount = amount;
  await nextHandUpdatesRepository.save(update);
}

export async function approveBuyInRequest(
  player: Player,
  game: PokerGame,
  amount: number
): Promise<BuyInApprovalStatus> {
  const playerGameTrackerRepository = getRepository(PlayerGameTracker);
  const playerInGame = await playerGameTrackerRepository.findOne({
    where: {
      game: {id: game.id},
      player: {id: player.id},
    },
  });

  if (!playerInGame) {
    logger.error(`Player ${player.name} is not in the game: ${game.gameCode}`);
    throw new Error(`Player ${player.name} is not in the game`);
  }

  // check amount should be between game.minBuyIn and game.maxBuyIn
  if (
    playerInGame.stack + amount < game.buyInMin ||
    playerInGame.stack + amount > game.buyInMax
  ) {
    throw new Error(
      `Buyin must be between ${game.buyInMin} and ${game.buyInMax}`
    );
  }

  playerInGame.buyInStatus = BuyInApprovalStatus.APPROVED;
  playerInGame.noOfBuyins++;
  playerInGame.stack += amount;
  playerInGame.buyIn += amount;

  // if the player is in the seat and waiting for buyin
  // then mark his status as playing
  if (
    playerInGame.seatNo !== 0 &&
    playerInGame.status === PlayerStatus.WAIT_FOR_BUYIN
  ) {
    playerInGame.status = PlayerStatus.PLAYING;
  }

  await playerGameTrackerRepository.update(
    {
      game: {id: game.id},
      player: {id: player.id},
    },
    {
      buyInStatus: playerInGame.buyInStatus,
      stack: playerInGame.stack,
      buyIn: playerInGame.buyIn,
      noOfBuyins: playerInGame.noOfBuyins,
      // buyinNotes: playerInGame.buyinNotes,
      status: playerInGame.status,
    }
  );

  // send a message to gameserver
  // get game server of this game
  playerBuyIn(game, player, playerInGame);

  return playerInGame.buyInStatus;
}
