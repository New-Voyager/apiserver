import {PokerGame} from '@src/entity/game/game';
import {Club, ClubSetting} from '@src/entity/player/club';
import {Player} from '@src/entity/player/player';
import {EntityManager} from 'typeorm';

class ClubMemberTrackingImpl {
  constructor() {}

  public async createClubSetting(clubId: number, entityManager: EntityManager) {
    const clubSettingRepo = entityManager.getRepository(ClubSetting);
    const clubSetting = new ClubSetting();
    clubSetting.clubId = clubId;
    await clubSettingRepo.save(clubSetting);
  }

  public async getBuyinTracking(club: Club, player: Player) {}

  public async getBalanceUpdates(club: Club, player: Player) {}

  public async setCredits(club: Club, player: Player, amount: number) {}

  public async addCredits(club: Club, player: Player, amount: number) {}

  public async autoApproveBuyin(club: Club, player: Player, approve: boolean) {}

  public async setPlayerBalance(club: Club, player: Player, amount: number) {}

  public async resetPlayerBalance(club: Club, player: Player) {}

  // called when game ended
  public async gameEnded(
    club: Club,
    game: PokerGame,
    entityManager: EntityManager
  ) {}

  // called when a player makes a new buyin
}

export const ClubMemberTracking = new ClubMemberTrackingImpl();
