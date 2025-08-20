import {
  Client,
  Message,
  OmitPartialGroupDMChannel,
  PartialMessage,
} from "discord.js";
import MySQL from "#libs/MySQL.js";
import calculateExperience from "#utils/calculateExperience.js";
import getConfig from "#utils/getConfig.js";
import { RowDataPacket } from "mysql2";

export default async function (
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>
) {
  const { channelID: countChannelID } = getConfig("counting") as {
    channelID: string;
  };
  if (message.channelId === countChannelID) return;

  if (!message.inGuild() || message.author?.bot) return;

  const experienceConfig = getConfig("experience") as any;
  if (!experienceConfig.enableExperience) return;

  const allowedChannels = experienceConfig.experienceChannels as string[];
  if (
    allowedChannels.length > 0 &&
    !allowedChannels.includes(message.channelId)
  )
    return;

  let multiplier = 1;
  const member = message.member;
  if (!member) return;

  const boosterCategories: string[] = [
    ...experienceConfig.boosterRoles,
    ...experienceConfig.boosterChannels,
    ...experienceConfig.boosterUsers,
  ];

  for (const booster of boosterCategories) {
    const [boosterID, boosterMultiplier] = booster.split(":");
    if (
      member.roles.cache.has(boosterID) ||
      member.user.id === boosterID ||
      message.channelId === boosterID
    )
      multiplier += experienceConfig.addExperienceMultiplier
        ? parseFloat(boosterMultiplier)
        : Math.max(multiplier, parseFloat(boosterMultiplier));
  }

  const xpToRemove = calculateExperience(message.content ?? "", multiplier);

  const [rows] = await MySQL.query<RowDataPacket[]>(
    "SELECT * FROM user_levels WHERE userID = ?",
    [message.author?.id]
  );

  if (rows.length === 0) return;

  const userData = rows[0];
  let currentXP = userData.experience - xpToRemove;
  let currentLevel = userData.level;

  const startingXPRequirement =
    experienceConfig.startingXPRequirement as number;
  const nextLevelXPRequirement =
    experienceConfig.nextLevelXPRequirement as number;

  while (
    currentLevel > 1 &&
    currentXP <
      startingXPRequirement * Math.pow(nextLevelXPRequirement, currentLevel - 2)
  ) {
    currentLevel -= 1;
    currentXP +=
      startingXPRequirement *
      Math.pow(nextLevelXPRequirement, currentLevel - 1);
  }

  if (currentXP < 0) currentXP = 0;

  await MySQL.query(
    "UPDATE user_levels SET level = ?, experience = ? WHERE userID = ?",
    [currentLevel, currentXP, message.author?.id]
  );

  // Handle level roles removal if needed
  if (experienceConfig.levelRoles && experienceConfig.replaceLevelRole) {
    for (const levelRole of experienceConfig.levelRoles) {
      const [roleID, levelRequired] = levelRole.split(":");
      if (
        member.roles.cache.has(roleID) &&
        currentLevel < parseInt(levelRequired, 10)
      ) {
        await member.roles.remove(roleID).catch(() => {});
      }
    }
  }
}
