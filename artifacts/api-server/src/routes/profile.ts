import { getAuth } from "@clerk/express";
import {
  GetMyProfileResponse,
  UpdateMyProfileBody,
  UpdateMyProfileResponse,
} from "@workspace/api-zod";
import { Router, type IRouter, type RequestHandler } from "express";
import { UserProfileModel, type UserProfile } from "../lib/mongo";

const router: IRouter = Router();

const requireAuth: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }

  res.locals.userId = userId;
  next();
};

function serializeProfile(
  profile: UserProfile & { _id: { toString(): string } },
) {
  return {
    id: profile._id.toString(),
    displayName: profile.displayName,
    bio: profile.bio,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

router.get("/profile", requireAuth, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as string;
  const now = new Date();
  const profile = await UserProfileModel.findOneAndUpdate(
    { clerkUserId: userId },
    {
      $setOnInsert: {
        clerkUserId: userId,
        displayName: "",
        bio: "",
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
      timestamps: false,
    },
  ).exec();

  if (!profile) {
    res.status(500).json({ error: "Could not load profile" });
    return;
  }

  res.json(GetMyProfileResponse.parse(serializeProfile(profile)));
});

router.put("/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = res.locals.userId as string;
  const now = new Date();
  const profile = await UserProfileModel.findOneAndUpdate(
    { clerkUserId: userId },
    {
      $set: parsed.data,
      $setOnInsert: {
        clerkUserId: userId,
        createdAt: now,
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  ).exec();

  if (!profile) {
    res.status(500).json({ error: "Could not update profile" });
    return;
  }

  res.json(UpdateMyProfileResponse.parse(serializeProfile(profile)));
});

export default router;
