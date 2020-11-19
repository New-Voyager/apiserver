import {GameStatus} from '@src/entity/types';
import {GameRepository} from '@src/repositories/game';
import {getLogger} from '@src/utils/log';

/**
 * These APIs are only available for game server.
 */
class GameAPIs {
  public async updateBreakTime(req: any, resp: any) {
    const gameID = req.params.gameId;
    if (!gameID) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const playerID = req.params.playerId;
    if (!playerID) {
      const res = {error: 'Invalid player id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    await GameRepository.updateBreakTime(playerID, gameID);
    resp.status(200).send({status: 'OK'});
  }

  public async updatePlayerGameState(req: any, resp: any) {
    const gameID = req.body.gameId;
    if (!gameID) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const gameStatus = req.body.status;
    if (!gameStatus) {
      const res = {error: 'Invalid game status'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const playerID = req.body.playerId;
    if (!playerID) {
      const res = {error: 'Invalid player id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    await GameRepository.markPlayerGameState(playerID, gameID, gameStatus);
    resp.status(200).send({status: 'OK'});
  }

  public async updateGameStatus(req: any, resp: any) {
    const gameID = req.body.gameId;
    if (!gameID) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const gameStatus = req.body.status;
    if (!gameStatus) {
      const res = {error: 'Invalid game status'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }

    await GameRepository.markGameStatus(gameID, gameStatus);
    resp.status(200).send({status: 'OK'});
  }

  public async updateTableStatus(req: any, resp: any) {
    const gameID = req.body.gameId;
    if (!gameID) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const tableStatus = req.body.status;
    if (!tableStatus) {
      const res = {error: 'Invalid table status'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }

    await GameRepository.markTableStatus(gameID, tableStatus);
    resp.status(200).send({status: 'OK'});
  }

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

  public async startGame(req: any, resp: any) {
    const clubID = parseInt(req.param('club-id'));
    if (!clubID) {
      const res = {error: 'Invalid club id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const gameID = parseInt(req.param('game-id'));
    if (!gameID) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    try {
      await GameRepository.markGameStatus(gameID, GameStatus.ACTIVE);
      resp.status(200).send({status: 'OK'});
    } catch (err) {
      resp.status(500).send({error: err.message});
    }
  }
}

export const GameAPI = new GameAPIs();
