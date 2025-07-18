import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { RowDataPacket } from "mysql2";

const command: CommandType = {
  name: "embed-create",
  description: "Create an embed.",
  options: [
    {
      name: "title",
      description: "Title of the embed.",
      type: ApplicationCommandOptionType.String,
      max_length: 256,
      required: true,
    },
  ],
  permissions: [PermissionFlagsBits.Administrator],

  async script(client, interaction, debugStream) {
    debugStream.write("Getting data from interaction...");

    const title = interaction.options.getString("title", true);
    debugStream.write(`title: ${title}`);

    debugStream.write("Check if embed with same title exist...");

    const [existingEmbed] = await MySQL.query<RowDataPacket[]>(
      "SELECT title FROM embeds WHERE title = ?",
      [title]
    );

    if (existingEmbed.length > 0) {
      debugStream.write("Embed with this title already exists.");
      await interaction.editReply(
        "An embed with this title already exists. Embed titles must be unique."
      );
      return;
    }

    debugStream.write("Creating new embed...");
    await MySQL.query("INSERT INTO embeds (title) VALUES (?)", [title]);

    debugStream.write("Embed created successfully.");
    await interaction.followUp(
      `Embed "${title}" has been created. Use /admin-embed-edit to customize it.`
    );
  },
};

export default command;
