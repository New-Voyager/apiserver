import {Club} from '@src/entity/club';
import {PlayerGame} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {getRepository, LessThan, MoreThan, getManager} from 'typeorm';
import {getLogger} from '@src/utils/log';
import {
  PlayerStatus,
  PlayerChipsTrack,
  ClubChipsTransaction,
  ClubBalance,
  ClubPlayerBalance,
  ClubGameRake,
} from '@src/entity/chipstrack';

const logger = getLogger('chipstrack');
const INITIAL_BUYIN_COUNT = 1;

class ChipsTrackRepositoryImpl {
  public async saveChips(playerChipsData: any) {
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
        const playerSetIn = new PlayerChipsTrack();
        playerSetIn.club = club;
        playerSetIn.game = game.game;
        playerSetIn.player = player;
        playerSetIn.buyIn = playerChipsData.buyIn;
        playerSetIn.stack = playerChipsData.buyIn;
        playerSetIn.seatNo = playerChipsData.seatNo;
        playerSetIn.status = parseInt(PlayerStatus[playerChipsData.status]);
        playerSetIn.noOfBuyins = INITIAL_BUYIN_COUNT;
        const repository = getRepository(PlayerChipsTrack);
        const response = await repository.save(playerSetIn);
        return response.id;
      }
    } catch (e) {
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
      const playerChipsTrackRepository = getRepository(PlayerChipsTrack);

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
          where: {club: endGameData.club_id},
        });
        if (!clubBalance) {
          // logger.error(
          //   `club id ${endGameData.club_id} is not found in clubBalance table`
          // );
          // throw new Error(
          //   `club id ${endGameData.club_id} is not found in clubBalance table`
          // );
          clubBalance = new ClubBalance();
          clubBalance.club = club;
          clubBalance.balance = 0;
        }
        clubChipsTransaction.club = club;
        clubChipsTransaction.amount = clubGameRake.rake;
        clubChipsTransaction.balance =
          clubBalance.balance + clubGameRake.rake;
        clubChipsTransaction.description = `rake collected from game #${endGameData.game_id}`;
        const resp = await clubChipsTransactionRepository.save(clubChipsTransaction);
        // console.log(resp);
        clubBalance.balance += clubGameRake.rake;
        const resp1 = await clubBalanceRepository.save(clubBalance);
        // console.log(resp1);
        const playerChips = await playerChipsTrackRepository.find({
          relations: ['club', 'game', 'player'],
          where: {club: endGameData.club_id, game: endGameData.game_id},
        });
        // console.log(playerChips)
        playerChips.forEach(async playerChip => {
          let clubPlayerBalance = await clubPlayerBalanceRepository.findOne({
            relations: ['club'],
            where: {player: playerChip.player.id, club: endGameData.club_id},
          });
          // console.log(clubPlayerBalance);
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
          const resp2 = await clubPlayerBalanceRepository.save(clubPlayerBalance);
          // console.log(resp2);
        });
      });
      return true;
    } catch (e) {
      logger.error(`Error: ${JSON.stringify(e)}`);
      return new Error(JSON.stringify(e));
    }
  }
}

export const ChipsTrackRepository = new ChipsTrackRepositoryImpl();
