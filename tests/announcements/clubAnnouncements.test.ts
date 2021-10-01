import {Cache} from '../../src/cache';

import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {getClubAnnouncements} from './utils';

describe('getClubAnnouncements APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('getClubAnnouncements', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');

    const data = await getClubAnnouncements({
      clubCode,
      ownerId,
    });
    expect(data.announcements).toEqual([]);

    try {
      await getClubAnnouncements({
        clubCode,
        ownerId: 'test',
      });
    } catch (error) {
      const expectedError = 'Cannot find player uuid [test] in player repo';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await getClubAnnouncements({
        clubCode: 'test',
        ownerId,
      });
    } catch (error) {
      const expectedError = 'Cannot find club code [test] in club repo';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await getClubAnnouncements({
        clubCode,
        ownerId: playerId,
      });
    } catch (error) {
      const expectedError = 'Player: 1243ABC is not a member in club bbc';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache(`playerCache-test`, 'null');

    try {
      await getClubAnnouncements({
        clubCode,
        ownerId: 'test',
      });
    } catch (error) {
      const expectedError = 'Player test is not found';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache(`clubCache-test`, 'null');

    try {
      await getClubAnnouncements({
        clubCode: 'test',
        ownerId,
      });
    } catch (error) {
      const expectedError = 'Club test is not found';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }
  });
});
