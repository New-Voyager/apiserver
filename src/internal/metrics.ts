import {errToStr, getLogger} from '@src/utils/log';
import * as client from 'prom-client';

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

  public newGame() {
    this.numNewGames.inc();
  }

  public highHand() {
    this.numHighHands.inc();
  }
}

class MetricsAPIs {
  /**
   * @param req request object
   * @param resp response object
   */
  public async getMetrics(req: any, resp: any) {
    try {
      const metrics = await client.register.metrics();
      resp.status(200).send(metrics);
    } catch (err) {
      logger.error(`Error while collecting metrics: ${errToStr(err)}`);
      resp.status(500).send('Internal service error');
      return;
    }
  }
}

export const Metrics = new MetricsCollector();
export const MetricsAPI = new MetricsAPIs();
