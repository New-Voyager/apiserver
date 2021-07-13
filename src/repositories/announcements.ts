import {Club} from '@src/entity/player/club';
import {Announcement} from '@src/entity/player/announcements';
import {AnnouncementType} from '@src/entity/types';
import {AnnouncementData} from '@src/types';
import {getUserRepository} from '.';

class AnnouncementRepositoryImpl {
  public async addClubAnnouncement(
    club: Club,
    text: string,
    expiresAt: string
  ): Promise<boolean> {
    const announcementRepo = getUserRepository(Announcement);

    const newAnnouncement = new Announcement();
    newAnnouncement.club = club;
    newAnnouncement.text = text;
    newAnnouncement.expiresAt = new Date(expiresAt);
    newAnnouncement.announcementType = AnnouncementType.CLUB;

    await announcementRepo.save(newAnnouncement);
    return true;
  }

  public async addSystemAnnouncement(
    text: string,
    expiresAt: string
  ): Promise<boolean> {
    const announcementRepo = getUserRepository(Announcement);

    const newAnnouncement = new Announcement();
    newAnnouncement.text = text;
    newAnnouncement.expiresAt = new Date(expiresAt);
    newAnnouncement.announcementType = AnnouncementType.SYSTEM;

    await announcementRepo.save(newAnnouncement);
    return true;
  }

  public async clubAnnouncements(club: Club): Promise<Array<AnnouncementData>> {
    const announcementRepo = getUserRepository(Announcement);

    const resp = await announcementRepo.find({
      club: {id: club.id},
      announcementType: AnnouncementType.CLUB,
      // expiresAt: Not(LessThan(Date.now()))
    });
    const announcements = new Array<AnnouncementData>();
    for await (const data of resp) {
      announcements.push({
        text: data.text,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
      });
    }
    return announcements;
  }

  public async systemAnnouncements(): Promise<Array<AnnouncementData>> {
    const announcementRepo = getUserRepository(Announcement);

    const resp = await announcementRepo.find({
      announcementType: AnnouncementType.SYSTEM,
      // expiresAt: Not(LessThan(Date.now()))
    });
    const announcements = new Array<AnnouncementData>();
    for await (const data of resp) {
      announcements.push({
        text: data.text,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
      });
    }
    return announcements;
  }
}

export const AnnouncementsRepository = new AnnouncementRepositoryImpl();
