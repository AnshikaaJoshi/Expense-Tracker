import app from "./app";
import { logger } from "./lib/logger";
import { connectMongoDB } from "./lib/mongo";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  try {
    await connectMongoDB();
    app.listen(port, () => {
      logger.info({ port }, "Server listening");
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : "Unknown startup error" },
      "Could not start API server",
    );
    process.exit(1);
  }
}

void start();
