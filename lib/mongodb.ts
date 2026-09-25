import mongoose from "mongoose";
import GroupJoinRequest from "@/models/GroupJoinRequest";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) throw new Error("MONGODB_URI is missing");

let indexesReady = false;

declare global {
  var mongooseCache:
    | { conn: typeof mongoose.connection | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

const cached = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cached;

export async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      dbName: process.env.DB_NAME,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false,
    }).then((connection) => connection.connection);
  }
  try {
    cached.conn = await cached.promise;
    if (!indexesReady) {
      try {
        const indexes = await GroupJoinRequest.collection.indexes();
        const legacy = indexes.find((index) => index.name === "groupId_1_membershipId_1" && index.unique && !index.partialFilterExpression);
        if (legacy) await GroupJoinRequest.collection.dropIndex(legacy.name!);
        await GroupJoinRequest.syncIndexes();
      } catch (error) {
        console.error("JOIN REQUEST INDEX SYNC ERROR:", error);
      }
      indexesReady = true;
    }
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}
