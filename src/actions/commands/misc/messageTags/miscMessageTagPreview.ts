import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import createEmbed from "#utils/createEmbed.js";
import { ApplicationCommandOptionType } from "discord.js";
import { RowDataPacket } from "mysql2";

const command: CommandType = {
  name: "misc-message-tag-preview",
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
      "SELECT title FROM message_tags"
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
      "SELECT * FROM message_tags WHERE title = ?",
      [tagTitle]
    );

    if (!existingTags.length) {
      await interaction.followUp("No tag found with that title.");
      return;
    }

    const embedTag = createEmbed({
      title: existingTags[0].title,
      description: existingTags[0].description,
    });

    await interaction.followUp({ embeds: [embedTag] });
  },
};

export default command;
