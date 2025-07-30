import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { RowDataPacket } from "mysql2";

const command: CommandType = {
  name: "form-delete",
  description: "Delete an existing form.",
  options: [
    {
      name: "form-title",
      description: "The title of the form you want to delete",
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
      required: true,
    },
  ],
  permissions: [PermissionFlagsBits.Administrator],

  async handleAutoComplete(client, interaction, focusedOption) {
    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT title FROM forms"
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

    const formTitle = interaction.options.getString("form-title", true);
    debugStream.write(`formTitle: ${formTitle}`);

    debugStream.write("Checking if form exist...");

    const [existingEmbed] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM forms WHERE title = ?",
      [formTitle]
    );

    if (!existingEmbed.length) {
      debugStream.write("Form doesn't exist! Sending reply...");
      await interaction.editReply("No form found with that title.");
      debugStream.write("Reply sent!");
      return;
    }

    debugStream.write("Form exist! Deleting it...");

    await MySQL.query("DELETE FROM forms WHERE title = ?", [formTitle]);

    debugStream.write("Form deleted! Sending follow up...");

    await interaction.followUp(`Successfully deleted form "${formTitle}"`);

    debugStream.write("Follow up sent!");
  },
};

export default command;
