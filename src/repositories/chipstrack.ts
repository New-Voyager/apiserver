import {PlayerGame} from '@src/entity/game';
import {Player} from '@src/entity/player';
import {Club} from '@src/entity/club';
import {getRepository, LessThan, MoreThan, getManager} from 'typeorm';
import {getLogger} from '@src/utils/log';
const logger = getLogger('chipstrack');
const INITIAL_BUYIN_COUNT = 1;
import {PlayerStatus, PlayerGameTracker} from '@src/entity/chipstrack';
import {identity} from 'lodash';

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
}

export const ChipsTrackRepository = new ChipsTrackRepositoryImpl();
