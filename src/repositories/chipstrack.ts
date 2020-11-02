import {PokerGame} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {Club, ClubMember} from '@src/entity/club';
import {getConnection, getRepository, getManager} from 'typeorm';
import {getLogger} from '@src/utils/log';
import {isPostgres} from '@src/utils';
import {
  PlayerGameTracker,
  ClubChipsTransaction,
  ClubBalance,
  ClubGameRake,
} from '@src/entity/chipstrack';
import {GameRepository} from '@src/repositories/game';
import {PlayerStatus} from '@src/entity/types';
import {PlayerSitInput} from './types';

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
      if (playerChipsData.clubId !== 0) {
        playerSetIn.club = club;
      }
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
        UPDATE poker_game SET players_in_seats = players_in_seats + 1
        WHERE id = ${placeHolder}`;
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
            relations: ['club', 'game', 'player'],
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

  public async endGame(endGameData: any): Promise<any> {
    try {
      if (endGameData.club_id === 0) {
        return true;
      }
      const clubRepository = getRepository(Club);
      const gameRepository = getRepository(PokerGame);
      const clubChipsTransactionRepository = getRepository(
        ClubChipsTransaction
      );
      const clubBalanceRepository = getRepository(ClubBalance);
      const clubMemberRepository = getRepository(ClubMember);
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

      await getManager().transaction(async transactionalEntityManager => {
        const clubChipsTransaction = new ClubChipsTransaction();
        let clubBalance = await clubBalanceRepository.findOne({
          relations: ['club'],
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

        clubBalance.balance += clubGameRake.rake;
        const resp1 = await clubBalanceRepository.save(clubBalance);

        const playerChips = await playerGameTrackRepository.find({
          relations: ['club', 'game', 'player'],
          where: {club: endGameData.club_id, game: endGameData.game_id},
        });
        for await (const playerChip of playerChips) {
          let clubPlayerBalance = await clubMemberRepository.findOne({
            relations: ['player', 'club'],
            where: {player: playerChip.player.id, club: endGameData.club_id},
          });
          if(clubPlayerBalance) {
            clubPlayerBalance.balance += playerChip.stack - playerChip.buyIn;
            clubPlayerBalance.totalBuyins += playerChip.buyIn;
            clubPlayerBalance.totalWinnings += playerChip.stack;
            clubPlayerBalance.notes = '';
            const resp2 = await clubMemberRepository.save(
              clubPlayerBalance
            );
          }
        }

        // update session time
        let placeHolder1 = '$1';
        let placeHolder2 = '$2';
        if (!isPostgres()) {
          placeHolder1 = '?';
          placeHolder2 = '?';
        }
        // SOMA: the following query does not work in sqllite
        // skip this for now
        // TODO: Need fix for sqllite
        if (isPostgres()) {
          const query = `UPDATE player_game_tracker SET session_time=coalesce(ROUND(EXTRACT(EPOCH FROM (NOW()-sat_at))), 0)+coalesce(session_time, 0) 
                WHERE game_id=${placeHolder1} AND club_id=${placeHolder2}`;
          await getConnection().query(query, [game.id, club.id]);
        }
        GameRepository.markGameEnded(club.id, game.id);
      });
      return true;
    } catch (e) {
      logger.error(`Error: ${JSON.stringify(e)}`);
      return new Error(JSON.stringify(e));
    }
  }

  public async getClubBalance(clubCode: string): Promise<ClubBalance> {
    const clubRepository = getRepository(Club);
    const clubBalanceRepository = getRepository(ClubBalance);
    const club = await clubRepository.findOne({
      where: {clubCode: clubCode},
    });
    if (!club) {
      logger.error(`Club ${clubCode} is not found`);
      throw new Error(`Club ${clubCode} is not found`);
    }
    const clubBalance = await clubBalanceRepository.findOne({
      where: {club: club.id},
    });
    if (!clubBalance) {
      logger.error(`Club ${clubCode} is not found`);
      throw new Error(`Club ${clubCode} is not found`);
    }
    logger.debug(clubBalance);
    return clubBalance;
  }

  public async getPlayerBalance(
    playerId: string,
    clubCode: string
  ) : Promise<ClubMember> {
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

  public async getPlayerGametrack(
    playerId: string,
    clubCode: string,
    gameCode: string
  ): Promise<PlayerGameTracker> {
    const clubRepository = getRepository(Club);
    const gameRepository = getRepository(PokerGame);
    const playerRepository = getRepository(Player);
    const playerGameTrackerRepository = getRepository(PlayerGameTracker);
    let club = await clubRepository.findOne({
      where: {clubCode: clubCode},
    });
    const game = await gameRepository.findOne({
      where: {gameCode: gameCode},
    });
    const player = await playerRepository.findOne({
      where: {uuid: playerId},
    });
    if (clubCode === '000000') {
      club = new Club();
      club.id = 0;
    }
    if (!club) {
      throw new Error(`Club ${clubCode} is not found`);
    }
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }
    if (!player) {
      throw new Error(`Player ${playerId} is not found`);
    }
    let playerTrack;
    if (clubCode === '000000') {
      playerTrack = await playerGameTrackerRepository.findOne({
        where: {player: player.id, game: game.id},
      });
    } else {
      playerTrack = await playerGameTrackerRepository.findOne({
        where: {club: club.id, player: player.id, game: game.id},
      });
    }
    if (!playerTrack) {
      logger.error('Error in retreiving data');
      throw new Error('Error in retreiving data');
    }
    return playerTrack;
  }

  public async getClubGametrack(
    clubCode: string,
    gameCode: string
  ): Promise<ClubGameRake> {
    const clubRepository = getRepository(Club);
    const gameRepository = getRepository(PokerGame);
    const clubGameTrackerRepository = getRepository(ClubGameRake);
    let club = await clubRepository.findOne({
      where: {clubCode: clubCode},
    });
    const game = await gameRepository.findOne({
      where: {gameCode: gameCode},
    });
    if (clubCode === '000000') {
      club = new Club();
      club.id = 0;
    }
    if (!club) {
      throw new Error(`Club ${clubCode} is not found`);
    }
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }
    let clubTrack;
    if (clubCode === '000000') {
      clubTrack = await clubGameTrackerRepository.findOne({
        where: {game: game.id},
      });
    } else {
      clubTrack = await clubGameTrackerRepository.findOne({
        where: {club: club.id, game: game.id},
      });
    }
    if (!clubTrack) {
      logger.error('Error in retreiving data');
      throw new Error('Error in retreiving data');
    }
    return clubTrack;
  }
}

export const ChipsTrackRepository = new ChipsTrackRepositoryImpl();
