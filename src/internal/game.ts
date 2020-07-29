/**
 * These APIs are only available for game server.
 */
class GameAPIs {
  public async getGame(req: any, resp: any) {
    const clubID = req.params.clubID;
    if (!clubID) {
      const res = {error: 'Invalid club id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const gameNum = req.params.gameNum;
    if (!gameNum) {
      const res = {error: 'Invalid game num'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }

    resp.status(200).send({status: 'OK'});
  }
}

export const GameAPI = new GameAPIs();
