import {Cache} from '../../src/cache';

import {resetDatabase, startGqlServer} from '../utils/utils';
import * as clubutils from '../utils/club.testutils';
import {addClubAnnouncement} from './utils';

describe('addClubAnnouncement APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });
  test('addClubAnnouncement', async () => {
    const [clubCode, ownerId] = await clubutils.createClub();
    const playerId = await clubutils.createPlayer('adam', '1243ABC');

    const data = await addClubAnnouncement({
      clubCode,
      ownerId,
      text: 'test',
      expiresAt: new Date(),
    });
    expect(data.addClubAnnouncement).toEqual(true);

    try {
      await addClubAnnouncement({
        clubCode,
        ownerId: 'test',
        text: 'test',
        expiresAt: new Date(),
      });
    } catch (error) {
      const expectedError = 'Cannot find player uuid [test] in player repo';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await addClubAnnouncement({
        clubCode: 'test',
        ownerId,
        text: 'test',
        expiresAt: new Date(),
      });
    } catch (error) {
      const expectedError = 'Cannot find club code [test] in club repo';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    try {
      await addClubAnnouncement({
        clubCode,
        ownerId: playerId,
        text: 'test',
        expiresAt: new Date(),
      });
    } catch (error) {
      const expectedError = 'Player: 1243ABC is not a host in club bbc';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache(`playerCache-test`, 'null');

    try {
      await addClubAnnouncement({
        clubCode,
        ownerId: 'test',
        text: 'test',
        expiresAt: new Date(),
      });
    } catch (error) {
      const expectedError = 'Player test is not found';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }

    await Cache.setCache(`clubCache-test`, 'null');

    try {
      await addClubAnnouncement({
        clubCode: 'test',
        ownerId,
        text: 'test',
        expiresAt: new Date(),
      });
    } catch (error) {
      const expectedError = 'Club test is not found';
      expect(error.graphQLErrors[0].message).toEqual(expectedError);
    }
  });
});
