import { Client, Message, PartialMessage } from "discord.js";
import MySQL from "#libs/MySQL.js";
import calculateExperience from "#utils/calculateExperience.js";
import getConfig from "#utils/getConfig.js";
import sendLevelUpMessage from "#utils/sendLevelUpMessage.js";
import { RowDataPacket } from "mysql2";

export default async function (
  client: Client,
  oldMessage: Message<boolean> | PartialMessage,
  newMessage: Message<boolean> | PartialMessage
) {
  if (
    !newMessage.inGuild() ||
    newMessage.author?.bot ||
    !oldMessage.content ||
    !newMessage.content ||
    oldMessage.content === newMessage.content
  )
    return;

  const experienceConfig = getConfig("experience") as any;
  if (!experienceConfig.enableExperience) return;

  const allowedChannels = experienceConfig.experienceChannels as string[];
  if (
    allowedChannels.length > 0 &&
    !allowedChannels.includes(newMessage.channelId)
  )
    return;

  let multiplier = 1;
  const member = newMessage.member;
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
      newMessage.channelId === boosterID
    )
      multiplier += experienceConfig.addExperienceMultiplier
        ? parseFloat(boosterMultiplier)
        : Math.max(multiplier, parseFloat(boosterMultiplier));
  }

  const oldXP = calculateExperience(oldMessage.content, multiplier);
  const newXP = calculateExperience(newMessage.content, multiplier);
  const xpDiff = newXP - oldXP;

  if (xpDiff === 0) return;

  const [rows] = await MySQL.query<RowDataPacket[]>(
    "SELECT * FROM user_levels WHERE userID = ?",
    [newMessage.author?.id]
  );

  if (rows.length === 0) return;

  const userData = rows[0];
  let currentXP = userData.experience + xpDiff;
  let currentLevel = userData.level;

  const startingXPRequirement =
    experienceConfig.startingXPRequirement as number;
  const nextLevelXPRequirement =
    experienceConfig.nextLevelXPRequirement as number;

  const getRequiredXP = (level: number) =>
    startingXPRequirement * Math.pow(nextLevelXPRequirement, level - 1);

  // Level up
  while (currentXP >= getRequiredXP(currentLevel)) {
    currentXP -= getRequiredXP(currentLevel);
    currentLevel += 1;
    if (experienceConfig.enableLevelUpMessage) {
      await sendLevelUpMessage(
        client,
        newMessage.channelId,
        newMessage.author.displayName,
        currentLevel
      );
    }
  }

  // Level down
  while (currentLevel > 1 && currentXP < getRequiredXP(currentLevel - 1)) {
    currentLevel -= 1;
    currentXP += getRequiredXP(currentLevel - 1);
  }

  if (currentXP < 0) currentXP = 0;

  await MySQL.query(
    "UPDATE user_levels SET level = ?, experience = ? WHERE userID = ?",
    [currentLevel, currentXP, newMessage.author?.id]
  );

  // Handle level roles
  if (experienceConfig.levelRoles) {
    for (const levelRole of experienceConfig.levelRoles) {
      const [roleID, levelRequired] = levelRole.split(":");
      if (
        member.roles.cache.has(roleID) &&
        experienceConfig.replaceLevelRole &&
        currentLevel < parseInt(levelRequired, 10)
      ) {
        await member.roles.remove(roleID).catch(() => {});
      } else if (
        currentLevel >= parseInt(levelRequired, 10) &&
        !member.roles.cache.has(roleID)
      ) {
        await member.roles.add(roleID).catch(() => {});
      }
    }
  }
}
