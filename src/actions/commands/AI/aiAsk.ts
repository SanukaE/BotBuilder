import CommandType from "#types/CommandType.js";
import { ApplicationCommandOptionType } from "discord.js";
import Gemini from "#libs/Gemini.js";
import getConfig from "#utils/getConfig.js";
import { createPartFromUri, createUserContent } from "@google/genai";

const { enabled, model, fileManager } = Gemini();

const command: CommandType = {
  name: "ai-ask",
  description: "Ask the AI a question",
  options: [
    {
      name: "question",
      description: "The question you want to ask the AI",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: "file",
      description: "The file you want to use for the AI",
      type: ApplicationCommandOptionType.Attachment,
    },
  ],
  isDisabled: !enabled,

  async script(_, interaction, debugStream) {
    const { geminiModel } = getConfig("ai") as { geminiModel: string };

    debugStream.write("Initializing AI...");

    if (!enabled) {
      debugStream.write("AI is not enabled! Sending reply...");
      await interaction.editReply("AI is not enabled");
      debugStream.write("Reply sent!");
      return;
    }

    if (!model || !fileManager) {
      debugStream.write("AI is not initialized! Sending reply...");
      await interaction.editReply("AI is not initialized");
      debugStream.write("Reply sent!");
      return;
    }

    debugStream.write("AI initialized! Getting data from interaction...");

    const question = interaction.options.getString("question", true);
    const file = interaction.options.getAttachment("file");

    debugStream.write("Data received! Processing data...");

    if (file) {
      const mimeType = file.contentType;
      if (
        !mimeType ||
        !(
          mimeType.startsWith("image/") ||
          mimeType.startsWith("video/") ||
          mimeType.startsWith("audio/") ||
          mimeType.startsWith("text/") ||
          mimeType.startsWith("application/")
        )
      ) {
        debugStream.write("File is not an image or video! Sending reply...");
        await interaction.editReply(
          "Please provide an image, video or audio file"
        );
        debugStream.write("Reply sent!");
        return;
      }
    }

    debugStream.write("Data processed! Asking AI...");

    let result;

    if (file) {
      debugStream.write(`Attempting to fetch file from URL: ${file.url}`);

      const fileResponse = await fetch(file.url);
      const fileBlob = await fileResponse.blob();

      debugStream.write("File fetched successfully, uploading to AI...");

      const userFile = await fileManager.upload({
        file: fileBlob,
        config: {
          mimeType: file.contentType || "text/plain",
        },
      });

      result = await model.generateContent({
        model: geminiModel || "gemini-2.5-flash",
        contents: createUserContent([
          createPartFromUri(userFile.uri!, userFile.mimeType!),
          question,
        ]),
        config: {
          tools: [{ urlContext: {} }, { googleSearch: {} }],
          maxOutputTokens: 500,
        },
      });
    } else
      result = await model.generateContent({
        model: geminiModel || "gemini-2.5-flash",
        contents: question,
        config: {
          tools: [{ urlContext: {} }, { googleSearch: {} }],
          maxOutputTokens: 500,
        },
      });

    const solution = result.text;
    let answer = solution || "No response from AI";

    debugStream.write("AI replied! Sending reply...");
    await interaction.followUp(answer);
    debugStream.write("Reply sent!");
  },
};

export default command;
