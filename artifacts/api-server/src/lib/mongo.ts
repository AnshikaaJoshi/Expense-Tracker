import mongoose, { Schema, type Model } from "mongoose";
import { logger } from "./logger";

export interface UserProfile {
  clerkUserId: string;
  displayName: string;
  bio: string;
  createdAt: Date;
  updatedAt: Date;
}

const userProfileSchema = new Schema<UserProfile>(
  {
    clerkUserId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    displayName: {
      type: String,
      default: "",
      maxlength: 80,
    },
    bio: {
      type: String,
      default: "",
      maxlength: 240,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "user_profiles",
  },
);

export const UserProfileModel: Model<UserProfile> =
  (mongoose.models.UserProfile as Model<UserProfile> | undefined) ??
  mongoose.model<UserProfile>("UserProfile", userProfileSchema);

export async function connectMongoDB(): Promise<void> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI must be set before starting the API server");
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  logger.info("Connected to MongoDB");
}
