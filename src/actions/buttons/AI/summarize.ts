import ButtonType from "#types/ButtonType.js";
import Gemini from "#libs/Gemini.js";
import getConfig from "#utils/getConfig.js";

const button: ButtonType = {
  customID: "ai-summarize",

  async script(_, interaction, debugStream) {
    const { geminiModel } = getConfig("ai") as { geminiModel: string };

    debugStream.write("Getting data from interaction...");

    const messageContent = interaction.message.content;

    debugStream.write(
      `messageContent: ${
        messageContent.length > 100
          ? messageContent.slice(0, 100) + "..."
          : messageContent
      }`
    );

    debugStream.write("Initializing AI...");

    const { enabled, model } = Gemini();

    if (!enabled) throw new Error("AI is not enabled.");
    if (!model) throw new Error("AI model wasn't initialized.");

    debugStream.write("AI initialized! Summarizing...");

    const result = await model.generateContent({
      model: geminiModel || "gemini-2.5-flash",
      contents: `Summarizing: ${messageContent}`,
      config: {
        tools: [{ urlContext: {} }, { googleSearch: {} }],
        maxOutputTokens: 500,
      },
    });
    const summary = result.text;

    if (!summary) throw new Error("Couldn't fetch summary.");

    debugStream.write("AI summarized! Sending follow up...");

    await interaction.followUp(summary);

    debugStream.write("Follow up sent!");
  },
};

export default button;
