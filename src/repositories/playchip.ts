import {PlayerCoin} from '@src/entity/player/appcoin';
import {Player} from '@src/entity/player/player';
import {PlayChip} from '@src/entity/player/play_chip';
import {getAppSettings} from '@src/firebase';
import {getUserRepository} from '.';

class PlayChipRepositoryImpl {
  public async newUser(player: Player) {
    const newUserPlayChips = getAppSettings().newUserPlayChips;
    const playChipsRepo = getUserRepository(PlayChip);
    const existingRow = await playChipsRepo.findOne({uuid: player.uuid});

    if (existingRow == null) {
      const playChips = new PlayChip();
      playChips.playerChips = newUserPlayChips;
      playChips.uuid = player.uuid;

      await playChipsRepo.save(playChips);
    }
  }

  public async getChips(uuid: string): Promise<number> {
    const playChipsRepo = getUserRepository(PlayChip);
    const existingRow = await playChipsRepo.findOne({uuid: uuid});

    if (existingRow != null) {
      return existingRow.playerChips;
    } else {
      return 0;
    }
  }
}

export const PlayChipRepository = new PlayChipRepositoryImpl();
