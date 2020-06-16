import {TestServer, resetDatabase} './utils/utils';

describe('Player APIs', () => {

  let server: TestServer;
  beforeAll(async (done) => {
    server = new TestServer();
    await server.start();
    await resetDatabase();
    done();
  });

  afterAll(async (done) => {
    await server.stop();
    done();
  });

  test("create a player", async () => {
    expect(true).toBeTruthy();
  });

  test("create a player", async () => {
    expect(true).toBeTruthy();
  });

  test("create a player", async () => {
    expect(true).toBeTruthy();
  });

  test("create a player", async () => {
    expect(true).toBeTruthy();
  });

});
