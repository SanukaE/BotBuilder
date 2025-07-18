import Gemini from "#libs/Gemini.js";
import CommandType from "#types/CommandType.js";
import createEmbed from "#utils/createEmbed.js";
import getConfig from "#utils/getConfig.js";
import {
  createPartFromUri,
  createUserContent,
  Schema,
  Type,
} from "@google/genai";
import { ApplicationCommandOptionType, Colors } from "discord.js";

const command: CommandType = {
  name: "ai-grammar-check",
  description: "Check your grammar, spelling & get an overall rating",
  options: [
    {
      name: "content",
      description: "The content you want to check",
      type: ApplicationCommandOptionType.String,
    },
    {
      name: "file",
      description:
        "The file which you want to check. (only supports pdf, txt, rtf & md files)",
      type: ApplicationCommandOptionType.Attachment,
    },
  ],

  async script(_, interaction, debugStream) {
    const { geminiModel } = getConfig("ai") as { geminiModel: string };

    debugStream.write("Getting data from interaction...");

    const userContent = interaction.options.getString("content");
    const userFile = interaction.options.getAttachment("file");

    debugStream.write(
      `userContent: ${
        userContent && userContent.length > 10
          ? userContent.slice(0, 10) + "..."
          : userContent
      }`
    );
    debugStream.write(`userFile: ${userFile?.url}`);

    if (!userContent && !userFile) {
      debugStream.write(
        "Both userContent & userFile are not provided. Sending response..."
      );
      await interaction.editReply(
        "Please provide either a text or a file to check."
      );
      debugStream.write("Response sent!");
      return;
    }

    if (userFile) {
      debugStream.write("Checking if file type is valid...");

      const supportedFileTypes = [
        "application/pdf",
        "text/plain",
        "text/md",
        "text/rtf",
      ];

      if (
        !supportedFileTypes.some((type) =>
          userFile.contentType?.startsWith(type)
        )
      ) {
        debugStream.write("File type is not supported! Sending response...");
        await interaction.editReply(
          "Sorry, but your file type is not supported. (Supported file types are pdf, txt, rtf & md)"
        );
        debugStream.write("Response sent!");
        return;
      }

      debugStream.write("File type is supported! Preceding...");
    }

    debugStream.write("Initializing AI...");

    const gemini = Gemini();

    if (!gemini.enabled) {
      debugStream.write("AI is disabled. Sending response...");
      await interaction.editReply(
        "I'm sorry but AI is disabled on this server."
      );
      debugStream.write("Response is sent!");
    }

    if (!gemini.model || !gemini.fileManager)
      throw new Error(
        "Failed to initialize AI: Model and FileManager are not available."
      );

    debugStream.write("Done! Getting rating...");

    const ratingSchema: Schema = {
      description:
        "An object containing various properties related to the quality of the content",
      type: Type.OBJECT,
      properties: {
        grammar: {
          type: Type.NUMBER,
          description: "Grammar score out of 100",
          maximum: 100,
          minimum: 0,
        },
        spelling: {
          type: Type.NUMBER,
          description: "Spelling accuracy score out of 100",
          maximum: 100,
          minimum: 0,
        },
        clarity: {
          type: Type.NUMBER,
          description:
            "How clear and understandable the text is, scored out of 100",
          maximum: 100,
          minimum: 0,
        },
        tone: {
          type: Type.STRING,
          description:
            "The overall tone of the text (e.g., formal, informal, professional)",
        },
        suggestions: {
          type: Type.ARRAY,
          description:
            "List of improvement suggestions. An empty array if none.",
          items: {
            type: Type.STRING,
            description: "suggestion",
          },
        },
        overallScore: {
          type: Type.NUMBER,
          description: "Overall writing quality score out of 100",
          maximum: 100,
          minimum: 0,
        },
      },
      required: [
        "grammar",
        "spelling",
        "clarity",
        "tone",
        "suggestions",
        "overallScore",
      ],
    };

    let generateContext: any[] = [
      "Please provide a detailed summary and analysis of the following content, including grammar, spelling, clarity, tone, and overall quality. If there are any suggestions for improvement, please include them as well.",
    ];

    if (userFile) {
      const fileBlob = await fetch(userFile.url).then((res) => res.blob());

      const fileResult = await gemini.fileManager.upload({
        file: fileBlob,
        config: {
          mimeType: userFile.contentType || "text/plain",
          displayName: userFile.title || undefined,
        },
      });

      generateContext.push(
        createPartFromUri(fileResult.uri!, fileResult.mimeType!)
      );
    }

    if (userContent) generateContext.push(userContent);

    const result = await gemini.model.generateContent({
      model: geminiModel || "gemini-2.5-flash",
      contents: createUserContent(generateContext),
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: ratingSchema,
      },
    });

    if (!result.text) throw new Error("Failed to check your grammar.");

    const ratingData = JSON.parse(result.text);

    debugStream.write("Done! Creating embed...");

    const embedMessage = createEmbed({
      color: Colors.DarkGreen,
      title: "Grammar Check",
      description: ratingData.suggestions.length
        ? `Suggestions: \n${ratingData.suggestions.join("\n")}`
        : "",
      fields: [
        {
          name: "📝 Grammar",
          value: `${ratingData.grammar}/100`,
          inline: true,
        },
        {
          name: "✍️ Spelling",
          value: `${ratingData.spelling}/100`,
          inline: true,
        },
        {
          name: "🔍 Clarity",
          value: `${ratingData.clarity}/100`,
          inline: true,
        },
        { name: "🎭 Tone", value: ratingData.tone, inline: true },
        {
          name: "⭐ Overall Score",
          value: `${ratingData.overallScore}/100`,
          inline: true,
        },
      ],
    });

    debugStream.write("Embed created! Sending follow up...");

    await interaction.followUp({
      embeds: [embedMessage],
    });

    debugStream.write("Follow up sent!");
  },
};

export default command;
