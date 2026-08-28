import { app } from "./app.ts";
import { env } from "./lib/env.ts";
import { logger } from "./lib/logger.ts";
import { startPaymentPoller } from "./services/payment/poller.ts";
import { startRetentionScheduler } from "./services/retention.ts";
app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, trustProxyHops: env.TRUST_PROXY_HOPS },
    "CryptoShop Backend gestartet"
  );
  startPaymentPoller(env.PAYMENT_POLL_INTERVAL_MS);
  startRetentionScheduler();
});
