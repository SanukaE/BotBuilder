import MySQL from "#libs/MySQL.js";
import calculateExperience from "#utils/calculateExperience.js";
import getConfig from "#utils/getConfig.js";
import sendLevelUpMessage from "#utils/sendLevelUpMessage.js";
import { Client, Message, OmitPartialGroupDMChannel } from "discord.js";
import { RowDataPacket } from "mysql2";

export default async function (
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean>>
) {
  if (!message.deletable) return;
  if (message.author.bot || !message.inGuild()) return;

  if (message.guildId !== (getConfig("application") as any).productionGuildID)
    return;

  const { channelID: countChannelID } = getConfig("counting") as {
    channelID: string;
  };
  if (message.channelId === countChannelID) return;

  const experienceConfig = getConfig("experience") as any;
  if (!experienceConfig.enableExperience) return;

  const allowedChannels = experienceConfig.experienceChannels as string[];
  if (
    allowedChannels.length > 0 &&
    !allowedChannels.includes(message.channelId)
  )
    return;

  let multiplier = 1;

  const member = message.member!;
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

  const xpGained = calculateExperience(message.content, multiplier);
  const [rows] = await MySQL.query<RowDataPacket[]>(
    "SELECT * FROM user_levels WHERE userID = ?",
    [message.author.id]
  );

  const checkLevelUp = (currentXP: number, level: number) => {
    const startingXPRequirement =
      experienceConfig.startingXPRequirement as number;
    const nextLevelXPRequirement =
      experienceConfig.nextLevelXPRequirement as number;

    const requiredXP =
      startingXPRequirement * Math.pow(nextLevelXPRequirement, level - 1);
    return { leveled: currentXP >= requiredXP, requiredXP };
  };

  let levelUp: { leveled: boolean; requiredXP: number } = {
    leveled: false,
    requiredXP: 0,
  };

  if (rows.length === 0) {
    levelUp = checkLevelUp(xpGained, 1);

    await MySQL.query(
      "INSERT INTO user_levels (userID, level, experience) VALUES (?, ?, ?)",
      [
        message.author.id,
        levelUp.leveled ? 2 : 1,
        levelUp.leveled ? xpGained - levelUp.requiredXP : xpGained,
      ]
    );

    if (levelUp.leveled)
      await sendLevelUpMessage(
        client,
        message.channelId,
        message.author.displayName,
        levelUp.leveled ? 2 : 1
      );
  } else {
    const userData = rows[0];
    const currentXP = userData.experience + xpGained;
    levelUp = checkLevelUp(currentXP, userData.level);

    await MySQL.query(
      "UPDATE user_levels SET level = ?, experience = ? WHERE userID = ?",
      [
        levelUp.leveled ? userData.level + 1 : userData.level,
        levelUp.leveled ? currentXP - levelUp.requiredXP : currentXP,
        message.author.id,
      ]
    );

    if (levelUp.leveled)
      await sendLevelUpMessage(
        client,
        message.channelId,
        message.author.displayName,
        levelUp.leveled ? userData.level + 1 : userData.level
      );
  }

  for (const levelRole of experienceConfig.levelRoles) {
    const [roleID, levelRequired] = levelRole.split(":");
    const role = await message.guild.roles.fetch(roleID);

    if (!role) throw new Error(`Role with ID ${roleID} not found.`);

    if (member.roles.cache.has(roleID) && experienceConfig.replaceLevelRole) {
      // If user already has this role and it's not the latest reward, remove it
      const userLevel =
        rows.length === 0
          ? levelUp.leveled
            ? 2
            : 1
          : levelUp.leveled
          ? rows[0].level + 1
          : rows[0].level;
      const highestRole = experienceConfig.levelRoles
        .map((r: string) => {
          const [id, lvl] = r.split(":");
          return { id, lvl: parseInt(lvl, 10) };
        })
        .filter((r: { lvl: number }) => r.lvl <= userLevel)
        .sort((a: { lvl: number }, b: { lvl: number }) => b.lvl - a.lvl)[0];

      if (highestRole && highestRole.id !== roleID) {
        await member.roles.remove(roleID);
      }
    } else {
      // Add the new role if the user has achieved the required level
      const userLevel =
        rows.length === 0
          ? levelUp.leveled
            ? 2
            : 1
          : levelUp.leveled
          ? rows[0].level + 1
          : rows[0].level;
      if (userLevel >= parseInt(levelRequired, 10)) {
        await member.roles.add(roleID);
      }
    }
  }
}
