import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import { ApplicationCommandOptionType } from "discord.js";
import { RowDataPacket } from "mysql2";

const command: CommandType = {
  name: "message-tag-create",
  description: "Create a new message tag.",
  options: [
    {
      name: "title",
      description: "Title of the tag",
      type: ApplicationCommandOptionType.String,
      max_length: 256,
      required: true,
    },
    {
      name: "description",
      description: "Description of the tag",
      type: ApplicationCommandOptionType.String,
      max_length: 4096,
      required: true,
    },
  ],

  async script(client, interaction, debugStream) {
    const tagTitle = interaction.options.getString("title", true);
    const tagDescription = interaction.options.getString("description", true);

    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT title FROM message_tags WHERE userID = ?",
      [interaction.user.id]
    );

    if (rows && rows.length !== 0) {
      await interaction.followUp(
        "You have already created a tag with the same title. Please use a different title."
      );
      return;
    }

    await MySQL.query(
      "INSERT INTO message_tags (userID, title, description) VALUES (?, ?, ?)",
      [interaction.user.id, tagTitle, tagDescription]
    );
    await interaction.followUp(
      "Tag created! Run /misc-message-tag-preview to view your new tag."
    );
  },
};

export default command;
