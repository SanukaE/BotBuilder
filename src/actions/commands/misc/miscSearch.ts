import {
  ApplicationCommandOptionType,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  Colors,
} from "discord.js";
import CommandType from "#types/CommandType.js";
import createEmbed from "#utils/createEmbed.js";
import Gemini from "#libs/Gemini.js";
import getConfig from "#utils/getConfig.js";

const command: CommandType = {
  name: "misc-search",
  description: "Make a quick google search.",
  options: [
    {
      name: "query",
      description: "The query you want to search for.",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  async script(_, interaction, debugStream) {
    const { geminiModel } = getConfig("ai") as { geminiModel: string };

    debugStream.write("Getting query from command options...");
    const query = interaction.options.getString("query")!;
    debugStream.write(`query: ${query}`);

    debugStream.write("Creating embed message...");
    const embedMessage = createEmbed({
      color: Colors.Aqua,
      title: "Google Search",
      thumbnail: {
        url: "https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_120x44dp.png",
      },
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    });
    debugStream.write("Embed created!");

    debugStream.write("Enabling AI...");
    const { enabled, model } = Gemini();
    debugStream.write(`enabled: ${enabled}`);

    debugStream.write("Checking if AI is available...");
    if (enabled && model) {
      debugStream.write("Getting result from model...");
      const result = await model.generateContent({
        model: geminiModel || "gemini-2.5-flash",
        contents: "Respond in less than 2000 charters:\n" + query,
        config: {
          tools: [{ googleSearch: {} }, { urlContext: {} }],
          maxOutputTokens: 1000,
        },
      });

      debugStream.write("Getting answer from result...");
      const answer = result.text;

      if (!answer) throw new Error("Failed to get AI response.");

      debugStream.write("Answer received! Setting embed description...");
      embedMessage.setDescription(answer);
    } else {
      debugStream.write(
        "AI is not available! Setting query as embed description..."
      );
      embedMessage.setDescription(
        query + "\nAI is disabled because no API key was set."
      );
    }
    debugStream.write("Description set!");

    debugStream.write("Creating button...");
    const resultButton = new ButtonBuilder({
      emoji: "🌐",
      label: "View search result",
      style: ButtonStyle.Link,
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    });
    const actionRow = new ActionRowBuilder<ButtonBuilder>({
      components: [resultButton],
    });
    debugStream.write("Button Created!");

    debugStream.write("Sending reply...");
    await interaction.followUp({
      embeds: [embedMessage],
      components: [actionRow],
    });
    debugStream.write("Reply sent!");
  },
};

export default command;
