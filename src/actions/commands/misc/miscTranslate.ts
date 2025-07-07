import {
  ApplicationCommandOptionType,
  Client,
  ChatInputCommandInteraction,
} from "discord.js";
import CommandType from "#types/CommandType.js";
import { LoggerType } from "#utils/createLogger.js";
import { translate } from "bing-translate-api";

const command: CommandType = {
  name: "misc-translate",
  description: "Translate any text to any language.",
  options: [
    {
      name: "text",
      description: "The text you want to be translated.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "language",
      description: "The language you want the text to be translated to. Eg: en",
      type: ApplicationCommandOptionType.String,
      autocomplete: true,
    },
  ],

  async handleAutoComplete(client, interaction, focusedOption) {
    const response = await fetch(
      "https://raw.githubusercontent.com/plainheart/bing-translate-api/4d7da66a135472e54272d1f2ca354f4a8e7b43fd/src/lang.json"
    );
    if (!response.ok) return;

    const supportedLanguages = await response.json();
    const usersInput = focusedOption.toLocaleLowerCase();

    const results = Object.entries(supportedLanguages).filter(
      ([key, value]) => {
        return (
          key.toLocaleLowerCase().startsWith(usersInput) ||
          (value as string).toLocaleLowerCase().startsWith(usersInput)
        );
      }
    );

    await interaction.respond(
      results.map(([code, language]) => ({
        name: language as string,
        value: code,
      }))
    );
  },

  script: async (
    _: Client,
    interaction: ChatInputCommandInteraction,
    debugStream: LoggerType
  ) => {
    debugStream.write("Getting data from command options:");
    const usersText = interaction.options.getString("text")!;
    debugStream.write(`usersText: ${usersText}`);
    const usersLanguage = interaction.options.getString("language");
    debugStream.write(`usersLanguage: ${usersLanguage}`);

    debugStream.write("Getting translation...");
    const translationData = await translate(
      usersText,
      undefined,
      usersLanguage || "en"
    );
    debugStream.write(`translation: ${translationData?.translation}`);

    debugStream.write("Sending reply...");
    await interaction.followUp({
      content: `${usersText}\n> *${translationData?.translation}*`,
    });
    debugStream.write("Reply sent!");
  },
};

export default command;
