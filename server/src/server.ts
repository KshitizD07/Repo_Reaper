import mongoose from "mongoose";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { initIngestionCron } from "./jobs/cron.js";

async function startServer() {
  try {
    logger.info(`Connecting to MongoDB at ${env.MONGODB_URI}...`);
    try {
      await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 2500 });
      logger.info("MongoDB connected successfully.");
    } catch (dbErr) {
      if (env.NODE_ENV === "development") {
        logger.warn("Local MongoDB instance not reachable. Initializing embedded development MongoDB (mongodb-memory-server)...");
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        const mongoServer = await MongoMemoryServer.create({
          instance: {
            port: 27017,
            dbName: "reporevive",
          },
        }).catch(async () => {
          // If port 27017 happens to be occupied, fallback to dynamic port
          return await MongoMemoryServer.create({
            instance: {
              dbName: "reporevive",
            },
          });
        });

        const uri = mongoServer.getUri();
        logger.info(`Embedded MongoDB started at ${uri}`);
        await mongoose.connect(uri);
        logger.info("Connected to embedded MongoDB.");

        const { User } = await import("./models/User.js");
        const userCount = await User.countDocuments();
        if (userCount === 0) {
          logger.info("Database is empty. Automatically running seed...");
          const { seedDatabase } = await import("./scripts/seed.js");
          await seedDatabase(false);
          logger.info("Database auto-seeded successfully.");
        }
      } else {
        throw dbErr;
      }
    }

    app.listen(env.PORT, () => {
      logger.info(`RepoRevive Express server listening on http://localhost:${env.PORT}`);
      initIngestionCron();
    });
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }
}

startServer();

