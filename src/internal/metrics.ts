import {errToStr, getLogger} from '@src/utils/log';
import * as client from 'prom-client';
import {Cache} from '@src/cache';

const logger = getLogger('internal::metrics');

class MetricsCollector {
  // Prometheus metrics naming convention - https://prometheus.io/docs/practices/naming/

  private numNewGames = new client.Counter({
    name: 'new_games_created_total',
    help: 'Number of new games created',
  });

  private numHighHands = new client.Counter({
    name: 'high_hands_logged_total',
    help: 'Number of high hands logged',
  });

  private numLiveGames = new client.Gauge({
    name: 'live_games',
    help: 'Number of live games',
  });

  private numActivePlayers = new client.Gauge({
    name: 'active_players',
    help: 'Number of active players',
  });

  public incNewGame() {
    this.numNewGames.inc();
  }

  public incHighHand() {
    this.numHighHands.inc();
  }

  public setLiveGames(val: number) {
    this.numLiveGames.set(val);
  }

  public setActivePlayers(val: number) {
    this.numActivePlayers.set(val);
  }
}

class MetricsAPIs {
  /**
   * @param req request object
   * @param resp response object
   */
  public async getMetrics(req: any, resp: any) {
    try {
      const numLiveGames: number = await getNumLiveGames();
      Metrics.setLiveGames(numLiveGames);
      const numActivePlayers: number = await getNumActivePlayers();
      Metrics.setActivePlayers(numActivePlayers);
      const metrics = await client.register.metrics();
      resp.status(200).send(metrics);
    } catch (err) {
      logger.error(`Error while collecting metrics: ${errToStr(err)}`);
      resp.status(500).send('Internal service error');
      return;
    }
  }
}

async function getNumLiveGames(): Promise<number> {
  return Cache.getNumLiveGames();
}

async function getNumActivePlayers(): Promise<number> {
  return Cache.getNumActivePlayers();
}

export const Metrics = new MetricsCollector();
export const MetricsAPI = new MetricsAPIs();
