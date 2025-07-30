import CommandType from "#types/CommandType.js";
import { ApplicationCommandOptionType } from "discord.js";
import MySQL from "#libs/MySQL.js";
import { RowDataPacket } from "mysql2";
import canvacord from "canvacord";
import getConfig from "#utils/getConfig.js";

const experienceConfig = getConfig("experience") as any;

const command: CommandType = {
  name: "leveling-info",
  description: "Get the user's info in the leveling system.",
  options: [
    {
      name: "user",
      description: "User to get the info for.",
      type: ApplicationCommandOptionType.User,
    },
  ],
  isGuildOnly: true,
  isDisabled: !experienceConfig.enableExperience,

  async script(client, interaction, debugStream) {
    const user = interaction.options.getUser("user") || interaction.user;
    const member = await interaction.guild!.members.fetch(user.id);

    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM user_levels ORDER BY level DESC"
    );

    const userIndex = rows.findIndex((row) => row.userID === user.id);
    if (userIndex === -1) {
      await interaction.followUp(`${user.displayName} has no leveling data.`);
      return;
    }

    const userData = rows[userIndex];
    const level = userData.level;
    const experience = userData.experience;

    const startingXPRequirement =
      experienceConfig.startingXPRequirement as number;
    const nextLevelXPRequirement =
      experienceConfig.nextLevelXPRequirement as number;

    const requiredXP =
      startingXPRequirement * Math.pow(nextLevelXPRequirement, level - 1);

    let multiplier = 1;

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
        interaction.channelId === boosterID
      )
        multiplier += experienceConfig.addExperienceMultiplier
          ? parseFloat(boosterMultiplier)
          : Math.max(multiplier, parseFloat(boosterMultiplier));
    }

    // Fetch user display name and avatar
    const displayName = member.displayName;
    const avatarURL = user.displayAvatarURL({ extension: "png", size: 256 });
    const bannerURL =
      member?.bannerURL({ extension: "png", size: 512 }) || undefined;

    // Create the rank card
    const rank = new canvacord.RankCardBuilder()
      .setAvatar(avatarURL)
      .setCurrentXP(experience)
      .setRequiredXP(requiredXP)
      .setLevel(level)
      .setRank(userIndex + 1)
      .setStatus(member?.presence?.status || "online")
      .setProgressCalculator(
        (experience: number, requiredXP: number) =>
          (experience / requiredXP) * 100
      )
      .setUsername(user.username)
      .setDisplayName(displayName)
      .setBackground(bannerURL || "")
      .setOverlay(90);

    const card = await rank.build();

    await interaction.followUp({
      files: [{ attachment: card, name: "level-card.png" }],
      content: `Boost Multiplier: x${multiplier}`,
    });
  },
};

export default command;
