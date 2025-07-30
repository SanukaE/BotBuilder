import CommandType from "#types/CommandType.js";
import getConfig from "#utils/getConfig.js";
import MySQL from "#libs/MySQL.js";
import { RowDataPacket } from "mysql2";
import { LeaderboardBuilder } from "canvacord";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const experienceConfig = getConfig("experience") as any;

const command: CommandType = {
  name: "leveling-leaderboard",
  description: "View the leveling leaderboard for the server.",
  isGuildOnly: true,
  isDisabled: !experienceConfig.enableExperience,

  async script(client, interaction, debugStream) {
    // Fetch top 10 users by level and experience
    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM user_levels ORDER BY level DESC, experience DESC LIMIT 10"
    );

    if (!rows.length) {
      await interaction.followUp("No users found in the leveling leaderboard.");
      return;
    }

    // Fetch user objects for display names and avatars
    const guild = interaction.guild!;
    const leaderboardData = await Promise.all(
      rows.map(async (row, idx) => {
        try {
          const member = await guild.members.fetch(row.userID);
          return {
            username: member.user.username,
            displayName: member.displayName,
            avatar: member.user.displayAvatarURL({
              extension: "png",
              size: 128,
            }),
            level: row.level,
            xp: row.experience,
            rank: idx + 1,
          };
        } catch {
          return {
            username: "Unknown",
            displayName: "Unknown",
            avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
            level: row.level,
            xp: row.experience,
            rank: idx + 1,
          };
        }
      })
    );

    // Build leaderboard image using canvacord
    const leaderboard = new LeaderboardBuilder()
      .setHeader({
        title: "Leveling Leaderboard",
        image:
          guild.iconURL() ||
          "https://i.postimg.cc/wB6FR8PP/Bot-Builder-Logo.webp",
        subtitle: "Top 10 Users",
      })
      .setBackground(guild.bannerURL() || "")
      .setBackgroundColor("#2C2F33")
      .setPlayers(leaderboardData)
      .setVariant("default");

    const leaderboardImage = await leaderboard.build();

    // Create link button
    const leaderboardUrl = `http://${process.env.WEB_SERVER_IP}:${process.env.WEB_SERVER_PORT}/leveling/leaderboard/`;
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder({
        url: leaderboardUrl,
        label: "View Full Leaderboard",
        style: ButtonStyle.Link,
      })
    );

    await interaction.followUp({
      files: [{ attachment: leaderboardImage, name: "leaderboard.png" }],
      components: [row],
    });
  },
};

export default command;
