import {PokerGame, PokerGameUpdates} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {Club, ClubMember} from '@src/entity/club';
import {getConnection, getRepository, getManager} from 'typeorm';
import {getLogger} from '@src/utils/log';
import {isPostgres} from '@src/utils';
import {PlayerGameTracker, ClubChipsTransaction} from '@src/entity/chipstrack';
import {PlayerStatus} from '@src/entity/types';
import {PlayerSitInput} from './types';
import {Cache} from '@src/cache';

const logger = getLogger('chipstrack');
const INITIAL_BUYIN_COUNT = 1;

class ChipsTrackRepositoryImpl {
  public async saveChips(
    playerChipsData: PlayerSitInput
  ): Promise<PlayerGameTracker | undefined> {
    try {
      const clubRepository = getRepository(Club);
      const gameRepository = getRepository(PokerGame);
      const playerRepository = getRepository(Player);

      let club = await clubRepository.findOne({
        where: {id: playerChipsData.clubId},
      });
      const game = await gameRepository.findOne({
        where: {id: playerChipsData.gameId},
      });
      const player = await playerRepository.findOne({
        where: {id: playerChipsData.playerId},
      });
      if (playerChipsData.clubId === 0) {
        club = new Club();
        club.id = 0;
      }
      if (!club) {
        throw new Error(`Club ${playerChipsData.clubId} is not found`);
      }
      if (!game) {
        throw new Error(`Game ${playerChipsData.gameId} is not found`);
      }
      if (!player) {
        throw new Error(`Player ${playerChipsData.playerId} is not found`);
      }
      const playerSetIn = new PlayerGameTracker();
      playerSetIn.game = game;
      playerSetIn.player = player;
      playerSetIn.buyIn = playerChipsData.buyIn;
      playerSetIn.stack = playerChipsData.buyIn;
      playerSetIn.seatNo = playerChipsData.seatNo;
      playerSetIn.hhRank = 0;
      playerSetIn.hhHandNum = 0;

      playerSetIn.status = PlayerStatus.PLAYING;
      playerSetIn.noOfBuyins = INITIAL_BUYIN_COUNT;
      playerSetIn.satAt = new Date();
      const repository = getRepository(PlayerGameTracker);
      const response = await repository.save(playerSetIn);

      // update number of players in the seats
      let placeHolder = '$1';
      if (!isPostgres()) {
        placeHolder = '?';
      }
      const query = `
        UPDATE poker_game_updates SET players_in_seats = players_in_seats + 1
        WHERE game_id = ${placeHolder}`;
      await getConnection().query(query, [game.id]);

      return response;
    } catch (e) {
      logger.error(
        'Error thrown when a player sits in a seat: ' + e.toString()
      );
      throw e;
    }
  }

  public async buyChips(
    playerChipsData: any
  ): Promise<PlayerGameTracker | undefined> {
    try {
      const clubRepository = getRepository(Club);
      const playerRepository = getRepository(Player);
      let club = await clubRepository.findOne({
        where: {id: playerChipsData.clubId},
      });
      const player = await playerRepository.findOne({
        where: {id: playerChipsData.playerId},
      });
      if (playerChipsData.clubId === 0) {
        club = new Club();
        club.id = 0;
      }
      if (!club) {
        logger.debug(`Club ${playerChipsData.clubId} is not found`);
        throw new Error(`Club ${playerChipsData.clubId} is not found`);
      }
      if (!player) {
        logger.debug(`Player ${playerChipsData.playerId} is not found`);
        throw new Error(`Player ${playerChipsData.playerId} is not found`);
      } else {
        const playerGameTrackrepository = getRepository(PlayerGameTracker);
        let playerGameTrack;
        if (playerChipsData.clubId !== 0) {
          playerGameTrack = await playerGameTrackrepository.findOne({
            relations: ['game', 'player'],
            where: {
              game: playerChipsData.gameId,
              player: playerChipsData.playerId,
              club: playerChipsData.clubId,
            },
          });
        } else {
          playerGameTrack = await playerGameTrackrepository.findOne({
            relations: ['game', 'player'],
            where: {
              game: playerChipsData.gameId,
              player: playerChipsData.playerId,
            },
          });
        }
        if (!playerGameTrack) {
          logger.error('No data found');
          throw new Error('No data found');
        }
        playerGameTrack.noOfBuyins =
          parseInt(playerGameTrack.noOfBuyins.toString()) + 1;
        playerGameTrack.buyIn =
          parseInt(playerGameTrack.buyIn.toString()) +
          parseInt(playerChipsData.buyChips);
        playerGameTrack.stack =
          parseInt(playerGameTrack.stack.toString()) +
          parseInt(playerChipsData.buyChips);
        const response = await playerGameTrackrepository.save(playerGameTrack);
        return response;
      }
    } catch (e) {
      logger.error(e);
      throw e;
    }
  }

  public async settleClubBalances(game: PokerGame): Promise<any> {
    try {
      if (!game.club) {
        // we don't track balances of individual host games
        return true;
      }

      const gameUpdatesRepo = getRepository(PokerGameUpdates);

      const gameId = game.id;
      const gameUpdates = await gameUpdatesRepo.findOne({
        gameID: gameId,
      });
      if (!gameUpdates) {
        throw new Error(`Game Updates for ${gameId} is not found`);
      }
      logger.info('****** STARTING TRANSACTION FOR RAKE CALCULATION');
      await getManager().transaction(async transactionEntityManager => {
        const clubChipsTransaction = new ClubChipsTransaction();
        clubChipsTransaction.club = game.club;
        clubChipsTransaction.amount = gameUpdates.rake;
        clubChipsTransaction.balance = game.club.balance + gameUpdates.rake;
        clubChipsTransaction.description = `rake collected from game #${game.gameCode}`;
        await transactionEntityManager
          .getRepository(ClubChipsTransaction)
          .save(clubChipsTransaction);
        const clubId = game.club.id;
        await transactionEntityManager
          .getRepository(Club)
          .createQueryBuilder()
          .update()
          .set({
            balance: () => `balance + ${gameUpdates.rake}`,
          })
          .where({
            id: clubId,
          })
          .execute();

        // update club member balance
        const playerChips = await transactionEntityManager
          .getRepository(PlayerGameTracker)
          .find({
            relations: ['game', 'player'],
            where: {game: {id: gameId}},
          });

        const chipUpdates = new Array<any>();
        for (const playerChip of playerChips) {
          const profit = playerChip.stack - playerChip.buyIn;
          const playerGame = transactionEntityManager
            .getRepository(ClubMember)
            .createQueryBuilder()
            .update()
            .set({
              balance: () => `balance + ${profit}`,
              totalBuyins: () => `total_buyins + ${playerChip.buyIn}`,
              totalWinnings: () => `total_winnings + ${playerChip.stack}`,
              notes: '',
            })
            .where({
              player: {id: playerChip.player.id},
              club: {id: clubId},
            })
            .execute();
          chipUpdates.push(playerGame);
        }
        await Promise.all(chipUpdates);
      });
      logger.info('****** ENDING TRANSACTION FOR RAKE CALCULATION');
      return true;
    } catch (e) {
      logger.error(`Error: ${JSON.stringify(e)}`);
      return new Error(JSON.stringify(e));
    }
  }

  public async getClubBalance(clubCode: string): Promise<Club> {
    const clubRepository = getRepository(Club);
    const club = await clubRepository.findOne({
      where: {clubCode: clubCode},
    });
    if (!club) {
      logger.error(`Club ${clubCode} is not found`);
      throw new Error(`Club ${clubCode} is not found`);
    }
    return club;
  }

  public async getPlayerBalance(
    playerId: string,
    clubCode: string
  ): Promise<ClubMember> {
    const clubRepository = getRepository(Club);
    const playerRepository = getRepository(Player);
    const clubMemberRepository = getRepository(ClubMember);
    const club = await clubRepository.findOne({
      where: {clubCode: clubCode},
    });
    const player = await playerRepository.findOne({
      where: {uuid: playerId},
    });
    if (!club) {
      logger.error(`Club ${clubCode} is not found`);
      throw new Error(`Club ${clubCode} is not found`);
    }
    if (!player) {
      logger.error(`Player ${playerId} is not found`);
      throw new Error(`Player ${playerId} is not found`);
    }
    const clubPlayerBalance = await clubMemberRepository.findOne({
      where: {club: club.id, player: player.id},
    });
    if (!clubPlayerBalance) {
      logger.error('Error in retreiving data');
      throw new Error('Error in retreiving data');
    }
    return clubPlayerBalance;
  }

  public async getRakeCollected(
    playerId: string,
    gameCode: string
  ): Promise<number> {
    // only club owner or game host can get the rake
    // verify it here

    const game = await Cache.getGame(gameCode);
    const gameUpdatesRepo = getRepository(PokerGameUpdates);
    const gameUpdates = await gameUpdatesRepo.find({
      where: {gameID: game.id},
    });
    if (!gameUpdates || gameUpdates.length === 0) {
      return 0;
    }
    return gameUpdates[0].rake;
  }
}

export const ChipsTrackRepository = new ChipsTrackRepositoryImpl();
