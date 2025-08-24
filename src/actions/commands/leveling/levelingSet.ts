import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { RowDataPacket } from "mysql2";
import getConfig from "#utils/getConfig.js";

const experienceConfig = getConfig("experience") as any;

const command: CommandType = {
  name: "leveling-set",
  description: "Set a user's level/experience.",
  options: [
    {
      name: "type",
      description: "Type of setting to change.",
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: [
        { name: "Level", value: "level" },
        { name: "Experience", value: "experience" },
      ],
    },
    {
      name: "user",
      description: "User to set the level/experience for.",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "value",
      description: "Value to set the level/experience to.",
      type: ApplicationCommandOptionType.Integer,
      required: true,
    },
  ],
  isGuildOnly: true,
  isDisabled: !experienceConfig.enableExperience,
  permissions: [PermissionFlagsBits.Administrator],

  async script(client, interaction, debugStream) {
    if (
      interaction.guildId !==
      (getConfig("application") as any).productionGuildID
    ) {
      await interaction.editReply(
        "This can only be used in the production server."
      );
      return;
    }

    const type = interaction.options.getString("type", true);
    const user = interaction.options.getUser("user", true);
    const value = interaction.options.getInteger("value", true);

    if (user.id === interaction.user.id) {
      await interaction.followUp(
        "You cannot set your own level or experience."
      );
      return;
    }

    if (user.bot) {
      await interaction.followUp(
        "You cannot set the level or experience for a bot."
      );
      return;
    }

    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM user_levels WHERE userID = ?",
      [user.id]
    );

    if (type === "level") {
      if (value < 1) {
        await interaction.followUp({
          content: "Level must be at least 1.",
          ephemeral: true,
        });
        return;
      }
      if (rows.length === 0) {
        await MySQL.query(
          "INSERT INTO user_levels (userID, level, experience) VALUES (?, ?, ?)",
          [user.id, value, 0]
        );
      } else {
        await MySQL.query("UPDATE user_levels SET level = ? WHERE userID = ?", [
          value,
          user.id,
        ]);
      }
      await interaction.followUp(`Set ${user}'s level to ${value}.`);
    } else if (type === "experience") {
      if (value < 0) {
        await interaction.followUp("Experience must be at least 0.");
        return;
      }
      if (rows.length === 0) {
        await MySQL.query(
          "INSERT INTO user_levels (userID, level, experience) VALUES (?, ?, ?)",
          [user.id, 1, value]
        );
      } else {
        await MySQL.query(
          "UPDATE user_levels SET experience = ? WHERE userID = ?",
          [value, user.id]
        );
      }
      await interaction.followUp(`Set ${user}'s experience to ${value}.`);
    } else {
      await interaction.followUp("Invalid type specified.");
    }
  },
};

export default command;
