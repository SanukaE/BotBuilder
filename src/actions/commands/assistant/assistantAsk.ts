import Assistant from "#libs/Assistant.js";
import Gemini from "#libs/Gemini.js";
import CommandType from "#types/CommandType.js";
import { ApplicationCommandOptionType } from "discord.js";

const gemini = Gemini();

const command: CommandType = {
  name: "assistant-ask",
  description: "Get BotBuilder assistant to performance a task for you.",
  isGuildOnly: true,
  isDisabled: !gemini.enabled,
  options: [
    {
      name: "request",
      description: "The request you want the bot to performance.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async script(client, interaction, debugStream) {
    const request = interaction.options.getString("request", true);

    const response = await Assistant(
      client,
      interaction.channelId,
      interaction.user.id,
      request
    );

    // The response will either be:
    // - A text response from the AI if no response function was called
    // - A message from the response function if it was called
    // - "Task complete!" as fallback if response is null but no response function was called
    if (response) {
      await interaction.followUp(response);
    } else {
      await interaction.followUp("Task complete!");
    }
  },
};

export default command;
