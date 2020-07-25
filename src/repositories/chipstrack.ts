import {PlayerGame, PokerGame} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {Club} from '@src/entity/club';
import {getRepository, LessThan, MoreThan, getManager} from 'typeorm';
import {getLogger} from '@src/utils/log';
import {
  PlayerStatus,
  PlayerGameTracker,
  ClubChipsTransaction,
  ClubBalance,
  ClubPlayerBalance,
  ClubGameRake,
} from '@src/entity/chipstrack';
import {identity} from 'lodash';

const logger = getLogger('chipstrack');
const INITIAL_BUYIN_COUNT = 1;

class ChipsTrackRepositoryImpl {
  public async saveChips(
    playerChipsData: any
  ): Promise<PlayerGameTracker | undefined> {
    try {
      const clubRepository = getRepository(Club);
      const gameRepository = getRepository(PlayerGame);
      const playerRepository = getRepository(Player);
      const club = await clubRepository.findOne({
        where: {id: playerChipsData.clubId},
      });
      const game = await gameRepository.findOne({
        where: {id: playerChipsData.gameId},
      });
      const player = await playerRepository.findOne({
        where: {id: playerChipsData.playerId},
      });
      if (!club) {
        throw new Error(`Club ${playerChipsData.clubId} is not found`);
      }
      if (!game) {
        throw new Error(`Game ${playerChipsData.gameId} is not found`);
      }
      if (!player) {
        throw new Error(`Player ${playerChipsData.playerId} is not found`);
      } else {
        const playerSetIn = new PlayerGameTracker();
        playerSetIn.club = club;
        playerSetIn.game = game.game;
        playerSetIn.player = player;
        playerSetIn.buyIn = playerChipsData.buyIn;
        playerSetIn.stack = playerChipsData.buyIn;
        playerSetIn.seatNo = playerChipsData.seatNo;
        playerSetIn.hhRank = 0;
        playerSetIn.hhHandNum = 0;
        playerSetIn.status = parseInt(PlayerStatus[playerChipsData.status]);
        playerSetIn.noOfBuyins = INITIAL_BUYIN_COUNT;
        const repository = getRepository(PlayerGameTracker);
        const response = await repository.save(playerSetIn);
        return response;
      }
    } catch (e) {
      throw e;
    }
  }

  public async buyChips(
    playerChipsData: any
  ): Promise<PlayerGameTracker | undefined> {
    try {
      const clubRepository = getRepository(Club);
      const gameRepository = getRepository(PlayerGame);
      const playerRepository = getRepository(Player);
      const club = await clubRepository.findOne({
        where: {id: playerChipsData.clubId},
      });
      const game = await gameRepository.findOne({
        where: {id: playerChipsData.gameId},
      });
      const player = await playerRepository.findOne({
        where: {id: playerChipsData.playerId},
      });
      if (!club) {
        logger.debug(`Club ${playerChipsData.clubId} is not found`);
        throw new Error(`Club ${playerChipsData.clubId} is not found`);
      }
      if (!game) {
        logger.debug(`Game ${playerChipsData.gameId} is not found`);
        throw new Error(`Game ${playerChipsData.gameId} is not found`);
      }
      if (!player) {
        logger.debug(`Player ${playerChipsData.playerId} is not found`);
        throw new Error(`Player ${playerChipsData.playerId} is not found`);
      } else {
        const playerGameTrackrepository = getRepository(PlayerGameTracker);
        const playerGameTrack = await playerGameTrackrepository.findOne({
          relations: ['club', 'game', 'player'],
          where: {
            game: playerChipsData.gameId,
            player: playerChipsData.playerId,
            club: playerChipsData.clubId,
          },
        });
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

  public async endGame(endGameData: any): Promise<any> {
    try {
      const clubRepository = getRepository(Club);
      const gameRepository = getRepository(PlayerGame);
      const clubChipsTransactionRepository = getRepository(
        ClubChipsTransaction
      );
      const clubBalanceRepository = getRepository(ClubBalance);
      const clubPlayerBalanceRepository = getRepository(ClubPlayerBalance);
      const clubGameRakeRepository = getRepository(ClubGameRake);
      const playerGameTrackRepository = getRepository(PlayerGameTracker);

      const club = await clubRepository.findOne({
        where: {id: endGameData.club_id},
      });
      const game = await gameRepository.findOne({
        where: {id: endGameData.game_id},
      });
      const clubGameRake = await clubGameRakeRepository.findOne({
        where: {club: endGameData.club_id, game: endGameData.game_id},
      });
      if (!club) {
        logger.error(`Club ${endGameData.club_id} is not found`);
        return new Error(`Club ${endGameData.club_id} is not found`);
      }
      if (!game) {
        logger.error(`Game ${endGameData.game_id} is not found`);
        return new Error(`Game ${endGameData.game_id} is not found`);
      }
      if (!clubGameRake) {
        logger.error(
          `Game ${endGameData.game_id} is not found in clubGameRake table`
        );
        return new Error(
          `Game ${endGameData.game_id} is not found in clubGameRake table`
        );
      }
      const response = new Array<any>();

      await getManager().transaction(async transactionalEntityManager => {
        const clubChipsTransaction = new ClubChipsTransaction();
        let clubBalance = await clubBalanceRepository.findOne({
          where: {club: endGameData.club_id},
        });
        if (!clubBalance) {
          clubBalance = new ClubBalance();
          clubBalance.club = club;
          clubBalance.balance = 0;
        }
        clubChipsTransaction.club = club;
        clubChipsTransaction.amount = clubGameRake.rake;
        clubChipsTransaction.balance = clubBalance.balance + clubGameRake.rake;
        clubChipsTransaction.description = `rake collected from game #${endGameData.game_id}`;
        const resp = await clubChipsTransactionRepository.save(
          clubChipsTransaction
        );
        response.push({
          clubChipsTransaction: {
            amount: resp.amount,
            balance: resp.balance,
            description: resp.description,
          },
        });

        clubBalance.balance += clubGameRake.rake;
        const resp1 = await clubBalanceRepository.save(clubBalance);
        response.push({clubBalance: {balance: resp1.balance}});

        const playerChips = await playerGameTrackRepository.find({
          relations: ['club', 'game', 'player'],
          where: {club: endGameData.club_id, game: endGameData.game_id},
        });
        for await (const playerChip of playerChips) {
          let clubPlayerBalance = await clubPlayerBalanceRepository.findOne({
            relations: ['club'],
            where: {player: playerChip.player.id, club: endGameData.club_id},
          });
          if (!clubPlayerBalance) {
            clubPlayerBalance = new ClubPlayerBalance();
            clubPlayerBalance.balance = 0;
            clubPlayerBalance.club = club;
            clubPlayerBalance.totalWinnings = 0;
            clubPlayerBalance.totalBuyins = 0;
            clubPlayerBalance.player = playerChip.player;
            clubPlayerBalance.notes = '';
          }
          clubPlayerBalance.balance += playerChip.stack;
          clubPlayerBalance.totalBuyins += playerChip.buyIn;
          clubPlayerBalance.totalWinnings += playerChip.stack;
          const resp2 = await clubPlayerBalanceRepository.save(
            clubPlayerBalance
          );
          response.push({
            clubPlayerBalance: {
              balance: resp2.balance,
              totalBuyins: resp2.totalBuyins,
              totalWinnings: resp2.totalWinnings,
              playerId: resp2.player.id,
            },
          });
        }
      });
      return response;
    } catch (e) {
      logger.error(`Error: ${JSON.stringify(e)}`);
      return new Error(JSON.stringify(e));
    }
  }

  public async getClubBalance(clubId: string): Promise<ClubBalance> {
    const clubRepository = getRepository(Club);
    const clubBalanceRepository = getRepository(ClubBalance);
    const club = await clubRepository.findOne({
      where: {displayId: clubId},
    });
    if (!club) {
      logger.error(`Club ${clubId} is not found`);
      throw new Error(`Club ${clubId} is not found`);
    }
    const clubBalance = await clubBalanceRepository.findOne({
      where: {club: club.id},
    });
    if (!clubBalance) {
      logger.error(`Club ${clubId} is not found`);
      throw new Error(`Club ${clubId} is not found`);
    }
    logger.debug(clubBalance);
    return clubBalance;
  }

  public async getPlayerBalance(
    playerId: string,
    clubId: string
  ): Promise<ClubPlayerBalance> {
    const clubRepository = getRepository(Club);
    const playerRepository = getRepository(Player);
    const clubPlayerBalanceRepository = getRepository(ClubPlayerBalance);
    const club = await clubRepository.findOne({
      where: {displayId: clubId},
    });
    const player = await playerRepository.findOne({
      where: {uuid: playerId},
    });
    if (!club) {
      logger.error(`Club ${clubId} is not found`);
      throw new Error(`Club ${clubId} is not found`);
    }
    if (!player) {
      logger.error(`Player ${playerId} is not found`);
      throw new Error(`Player ${playerId} is not found`);
    }
    const clubPlayerBalance = await clubPlayerBalanceRepository.findOne({
      where: {club: club.id, player: player.id},
    });
    if (!clubPlayerBalance) {
      logger.error('Error in retreiving data');
      throw new Error('Error in retreiving data');
    }
    return clubPlayerBalance;
  }

  public async getPlayerGametrack(
    playerId: string,
    clubId: string,
    gameId: string
  ): Promise<PlayerGameTracker> {
    const clubRepository = getRepository(Club);
    const gameRepository = getRepository(PokerGame);
    const playerRepository = getRepository(Player);
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    const club = await clubRepository.findOne({
      where: {displayId: clubId},
    });
    const game = await gameRepository.findOne({
      where: {gameId: gameId},
    });
    const player = await playerRepository.findOne({
      where: {uuid: playerId},
    });
    if (!club) {
      throw new Error(`Club ${clubId} is not found`);
    }
    if (!game) {
      throw new Error(`Game ${gameId} is not found`);
    }
    if (!player) {
      throw new Error(`Player ${playerId} is not found`);
    }
    const playerTrack = await playerGameTrackerRepository.findOne({
      where: {club: club.id, player: player.id, game: game.id},
    });
    if (!playerTrack) {
      logger.error('Error in retreiving data');
      throw new Error('Error in retreiving data');
    }
    return playerTrack;
  }

  public async getClubGametrack(
    clubId: string,
    gameId: string
  ): Promise<ClubGameRake> {
    const clubRepository = getRepository(Club);
    const gameRepository = getRepository(PokerGame);
    const clubGameTrackerRepository = getRepository(ClubGameRake);
    const club = await clubRepository.findOne({
      where: {displayId: clubId},
    });
    const game = await gameRepository.findOne({
      where: {gameId: gameId},
    });
    if (!club) {
      throw new Error(`Club ${clubId} is not found`);
    }
    if (!game) {
      throw new Error(`Game ${gameId} is not found`);
    }
    const clubTrack = await clubGameTrackerRepository.findOne({
      where: {club: club.id, game: game.id},
    });
    if (!clubTrack) {
      logger.error('Error in retreiving data');
      throw new Error('Error in retreiving data');
    }
    return clubTrack;
  }
}

export const ChipsTrackRepository = new ChipsTrackRepositoryImpl();
