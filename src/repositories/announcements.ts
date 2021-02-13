import {getRepository, LessThan, Not} from 'typeorm';
import {Club} from '@src/entity/club';
import {Announcement} from '@src/entity/announcements';
import {AnnouncementType} from '@src/entity/types';

class AnnouncementRepositoryImpl {
  public async addClubAnnouncement(
    club: Club,
    text: string,
    expiresAt: string
  ): Promise<boolean> {
    const announcementRepo = getRepository(Announcement);

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
    const announcementRepo = getRepository(Announcement);

    const newAnnouncement = new Announcement();
    newAnnouncement.text = text;
    newAnnouncement.expiresAt = new Date(expiresAt);
    newAnnouncement.announcementType = AnnouncementType.SYSTEM;

    await announcementRepo.save(newAnnouncement);
    return true;
  }

  public async clubAnnouncements(club: Club): Promise<Array<any>> {
    const announcementRepo = getRepository(Announcement);

    const resp = announcementRepo.find({
      club: {id: club.id},
      announcementType: AnnouncementType.CLUB,
      // expiresAt: Not(LessThan(Date.now()))
    });
    return resp;
  }

  public async systemAnnouncements(): Promise<Array<any>> {
    const announcementRepo = getRepository(Announcement);

    const resp = announcementRepo.find({
      announcementType: AnnouncementType.SYSTEM,
      // expiresAt: Not(LessThan(Date.now()))
    });

    return resp;
  }
}

export const AnnouncementsRepository = new AnnouncementRepositoryImpl();
