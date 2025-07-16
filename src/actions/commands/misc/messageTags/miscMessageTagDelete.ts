import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import { ApplicationCommandOptionType } from "discord.js";
import { RowDataPacket } from "mysql2";

const command: CommandType = {
  name: "misc-message-tag-delete",
  description: "Delete a message tag.",
  options: [
    {
      name: "title",
      description: "Title of the tag",
      type: ApplicationCommandOptionType.String,
      max_length: 256,
      autocomplete: true,
      required: true,
    },
  ],

  async handleAutoComplete(client, interaction, focusedOption) {
    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT title FROM message_tags WHERE userID = ?",
      [interaction.user.id]
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
    const tagTitle = interaction.options.getString("title", true);

    const [existingTags] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM message_tags WHERE title = ?, userID = ?",
      [tagTitle, interaction.user.id]
    );

    if (!existingTags.length) {
      await interaction.followUp("No tag found with that title.");
      return;
    }

    await MySQL.query("DELETE FROM message_tags WHERE title = ?, userID = ?", [
      tagTitle,
      interaction.user.id,
    ]);

    await interaction.followUp(`Successfully deleted tag "${tagTitle}"`);
  },
};

export default command;
