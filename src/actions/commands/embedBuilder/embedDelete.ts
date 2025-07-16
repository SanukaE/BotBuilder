import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { RowDataPacket } from "mysql2";

const command: CommandType = {
  name: "embed-delete",
  description: "Delete an existing embed.",
  options: [
    {
      name: "embed-title",
      description: "The title of the embed you want to delete",
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
      required: true,
    },
  ],
  permissions: [PermissionFlagsBits.Administrator],

  async handleAutoComplete(client, interaction, focusedOption) {
    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT title FROM embeds"
    );

    const focusedValues = rows.filter((row) =>
      row.title.startsWith(focusedOption)
    );
    if (!focusedValues.length) return;

    await interaction.respond(
      focusedValues.map((v) => ({ name: v.title, value: v.title }))
    );
  },

  async script(client, interaction, debugStream) {
    debugStream.write("Getting data from interaction...");

    const embedTitle = interaction.options.getString("embed-title", true);
    debugStream.write(`embedTitle: ${embedTitle}`);

    debugStream.write("Checking if embed exist...");

    const [existingEmbed] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM embeds WHERE title = ?",
      [embedTitle]
    );

    if (!existingEmbed.length) {
      debugStream.write("Embed doesn't exist! Sending reply...");
      await interaction.editReply("No embed found with that title.");
      debugStream.write("Reply sent!");
      return;
    }

    debugStream.write("Embed exist! Deleting it...");

    await MySQL.query("DELETE FROM embeds WHERE title = ?", [embedTitle]);

    debugStream.write("Embed deleted! Sending follow up...");

    await interaction.followUp({
      content: `Successfully deleted embed "${embedTitle}"`,
      ephemeral: true,
    });

    debugStream.write("Follow up sent!");
  },
};

export default command;
