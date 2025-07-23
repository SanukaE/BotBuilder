import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import { ApplicationCommandOptionType, PermissionFlagsBits } from "discord.js";
import { RowDataPacket } from "mysql2";

const command: CommandType = {
  name: "form-create",
  description: "Create a new form",
  options: [
    {
      name: "title",
      description: "The title of the form",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  permissions: [PermissionFlagsBits.Administrator],

  async script(client, interaction, debugStream) {
    debugStream.write("Getting data from interaction...");

    const title = interaction.options.getString("title", true);
    debugStream.write(`title: ${title}`);

    debugStream.write("Check if form with same title exist...");

    const [existingForm] = await MySQL.query<RowDataPacket[]>(
      "SELECT title FROM forms WHERE title = ?",
      [title]
    );

    if (existingForm.length > 0) {
      debugStream.write("Form with this title already exists.");
      await interaction.editReply(
        "An form with this title already exists. Form titles must be unique."
      );
      return;
    }

    debugStream.write("Creating new form...");
    await MySQL.query("INSERT INTO forms (title) VALUES (?)", [title]);

    debugStream.write("Form created successfully.");
    await interaction.followUp(
      `Form "${title}" has been created. Use /form-edit to customize it.`
    );
  },
};

export default command;
