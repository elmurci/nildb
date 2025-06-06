import { prometheus } from "@hono/prometheus";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { timeout } from "hono/timeout";
import { Temporal } from "temporal-polyfill";
import { buildBuildersRouter } from "#/builders/builders.router";
import { buildDataRouter } from "#/data/data.router";
import { corsMiddleware } from "#/middleware/cors.middleware";
import { useLoggerMiddleware } from "#/middleware/logger.middleware";
import { buildNilCommRouter } from "#/nilcomm/nilcomm.router";
import { buildQueriesRouter } from "#/queries/queries.router";
import { buildSchemasRouter } from "#/schemas/schemas.router";
import { buildUserRouter } from "#/user/user.router";
import {
  type AppBindings,
  type AppEnv,
  FeatureFlag,
  hasFeatureFlag,
} from "./env";
import { useMaintenanceMiddleware } from "./middleware/maintenance.middleware";
import { createOpenApiRouter } from "./openapi/openapi.router";
import { buildSystemRouter } from "./system/system.router";

export type App = Hono<AppEnv>;

export async function buildApp(
  bindings: AppBindings,
): Promise<{ app: App; metrics: Hono }> {
  const app = new Hono<AppEnv>();
  const metricsApp = new Hono();

  app.use(corsMiddleware(bindings));

  // 16mb corresponds to the max mongodb document size. However, this is a crude check
  // because in practice body could/will have multiple documents.
  app.use("*", bodyLimit({ maxSize: 16 * 1024 * 1024 }));

  app.use((c, next) => {
    c.env = bindings;
    return next();
  });

  buildSystemRouter({ app, bindings });

  if (
    hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.OPENAPI_SPEC)
  ) {
    createOpenApiRouter({ app, bindings });
  }

  app.use(useLoggerMiddleware(bindings.log));
  app.use(useMaintenanceMiddleware(bindings));

  const { printMetrics, registerMetrics } = prometheus();
  app.use("*", registerMetrics);
  metricsApp.get("/metrics", printMetrics);

  const limit = Temporal.Duration.from({ minutes: 5 }).total("milliseconds");
  app.use("*", timeout(limit));
  buildBuildersRouter({ app, bindings });
  buildSchemasRouter({ app, bindings });

  buildQueriesRouter({ app, bindings });
  buildDataRouter({ app, bindings });
  buildUserRouter({ app, bindings });

  if (hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.NILCOMM)) {
    await buildNilCommRouter({ app, bindings });
  }

  return { app, metrics: metricsApp };
}
