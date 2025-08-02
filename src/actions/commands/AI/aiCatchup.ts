import Gemini from "#libs/Gemini.js";
import CommandType from "#types/CommandType.js";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import createTempDataFile from "#utils/createTempDataFile.js";
import getAllFiles from "#utils/getAllFiles.js";
import { ApplicationCommandOptionType, Colors } from "discord.js";
import createEmbed from "#utils/createEmbed.js";
import {
  createPartFromUri,
  createUserContent,
  Schema,
  Type,
} from "@google/genai";
import getConfig from "#utils/getConfig.js";

type Data = {
  username: string;
  createdTimestamp: number;
  messageContent?: string;
  attachments?: {
    contentType: string;
    fileName: string;
    fileURL: string;
  }[];
  embeds?: { title: string; description: string }[];
};

type SummaryItem = {
  heading: string;
  content: string;
};

const gemini = Gemini();

const command: CommandType = {
  name: "ai-catchup",
  description: "Catch up on what you missed in the past.",
  isGuildOnly: true,
  options: [
    {
      name: "messages",
      description:
        "Specify the number of unread messages you want to catch up on.",
      type: ApplicationCommandOptionType.Integer,
      min_value: 10,
      max_value: 100,
      required: true,
    },
  ],
  isDisabled: !gemini.enabled,

  async script(_, interaction, debugStream) {
    try {
      const { geminiModel } = getConfig("ai") as { geminiModel: string };

      debugStream.write("Initializing AI...");

      if (!gemini.enabled) {
        debugStream.write("AI is not enabled! Sending reply...");
        await interaction.editReply("AI is not enabled");
        debugStream.write("Reply sent!");
        return;
      }

      debugStream.write("Done! Getting data from interaction...");

      const messageNo = interaction.options.getInteger("messages", true);
      debugStream.write(`messageNo: ${messageNo}`);
      debugStream.write("Fetching messages...");

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      // Find existing temp file
      const tempDir = path.join(__dirname, "../../../../temp");
      const allFiles = getAllFiles(tempDir);
      const tempFilePath = allFiles.find((filePath) =>
        path.basename(filePath).startsWith(`aiCatchup-${interaction.channelId}`)
      );

      let dataArray: Data[] = [];

      const getMessages = async (noOfMessage: number, before?: string) => {
        if (!interaction.channel) {
          throw new Error("Channel not found");
        }

        const channelMessage = await interaction.channel.messages.fetch({
          limit: noOfMessage,
          before,
        });

        const messageArray = Array.from(channelMessage.values()).reverse();

        const allowedContentTypes = [
          "application/pdf",
          "text/javascript",
          "text/x-python",
          "text/plain",
          "text/html",
          "text/css",
          "text/markdown",
          "text/csv",
          "text/xml",
          "text/rtf",
          "application/json",
        ];

        const tempDataArray: Data[] = [];

        for (const message of messageArray) {
          const messageData: Data = {
            username: message.author.displayName,
            createdTimestamp: message.createdTimestamp,
          };

          if (message.content.trim()) {
            messageData.messageContent = message.content;
          }

          const messageAttachments = message.attachments.filter(
            (attachment) =>
              attachment.contentType &&
              allowedContentTypes.includes(attachment.contentType) &&
              attachment.size <= 20 * 1024 * 1024 // 20MB limit
          );

          if (messageAttachments.size > 0) {
            messageData.attachments = Array.from(
              messageAttachments.values()
            ).map((a) => ({
              contentType: a.contentType!,
              fileName: a.name,
              fileURL: a.url,
            }));
          }

          if (message.embeds.length > 0) {
            messageData.embeds = message.embeds
              .filter((embed) => embed.title || embed.description)
              .map((embed) => ({
                title: embed.title ?? "",
                description: embed.description ?? "",
              }));
          }

          tempDataArray.push(messageData);
        }

        return tempDataArray;
      };

      // Handle existing temp file
      if (tempFilePath) {
        try {
          const fileName = path.basename(tempFilePath);
          const parts = fileName.split("-");
          const oldMessageNo = parseInt(parts[2]);
          const oldTimestamp = parts[3].replace(".json", "");

          const remainingMsg = messageNo - oldMessageNo;

          const fileContent = await fs.readFile(tempFilePath, "utf-8");
          dataArray = JSON.parse(fileContent);

          if (remainingMsg < 0) {
            const elementsToRemove = Math.abs(remainingMsg);
            dataArray = dataArray.slice(elementsToRemove);
          } else if (remainingMsg > 0) {
            const newMessages = await getMessages(remainingMsg, oldTimestamp);
            dataArray = [...newMessages, ...dataArray];

            const newFileName = `aiCatchup-${interaction.channelId}-${messageNo}-${dataArray[0].createdTimestamp}.json`;
            const newTempFilePath = path.join(
              path.dirname(tempFilePath),
              newFileName
            );

            await fs.writeFile(
              newTempFilePath,
              JSON.stringify(dataArray, null, 2)
            );
            await fs.unlink(tempFilePath);

            // Clean up after 1 hour
            setTimeout(async () => {
              try {
                await fs.access(newTempFilePath);
                await fs.unlink(newTempFilePath);
              } catch (error) {
                // File already deleted
              }
            }, 60 * 60 * 1000);
          }
        } catch (error) {
          debugStream.write(`Error handling temp file: ${error}`);
          dataArray = await getMessages(messageNo);
        }
      } else {
        dataArray = await getMessages(messageNo);

        if (dataArray.length > 0) {
          createTempDataFile(
            `aiCatchup-${interaction.channelId}-${messageNo}-${dataArray[0].createdTimestamp}.json`,
            JSON.stringify(dataArray, null, 2),
            60 * 60 * 1000
          );
        }
      }

      if (dataArray.length === 0) {
        await interaction.editReply("No messages found to summarize.");
        return;
      }

      debugStream.write("Messages collected! Processing attachments...");

      const uploadedFiles: any[] = [];
      const processedAttachments = new Set<string>();

      // Process attachments with better error handling
      for (const data of dataArray) {
        if (data.attachments && data.attachments.length > 0) {
          for (const attachment of data.attachments) {
            const fileKey = `${attachment.fileName}-${attachment.fileURL}`;

            if (processedAttachments.has(fileKey)) {
              continue; // Skip duplicate attachments
            }

            processedAttachments.add(fileKey);

            try {
              const response = await fetch(attachment.fileURL);
              if (!response.ok) {
                debugStream.write(
                  `Failed to fetch ${attachment.fileName}: ${response.status}`
                );
                continue;
              }

              const fileBuffer = await response.arrayBuffer();
              const fileData = Buffer.from(fileBuffer);

              // Validate file size (Gemini has limits)
              if (fileData.length > 20 * 1024 * 1024) {
                debugStream.write(
                  `File ${attachment.fileName} too large, skipping`
                );
                continue;
              }

              const tempFileName = `temp_${Date.now()}_${attachment.fileName}`;
              createTempDataFile(tempFileName, fileData);

              const uploadResult = await gemini.fileManager!.upload({
                file: `./public/${tempFileName}`,
                config: { mimeType: attachment.contentType },
              });

              uploadedFiles.push(
                createPartFromUri(uploadResult.uri!, uploadResult.mimeType!)
              );
            } catch (error) {
              debugStream.write(
                `Error processing attachment ${attachment.fileName}: ${error}`
              );
            }
          }
        }
      }

      debugStream.write("Generating summary...");

      // Create a simplified data structure for the summary
      const summaryData = dataArray.map((data) => ({
        username: data.username,
        timestamp: new Date(data.createdTimestamp).toISOString(),
        message: data.messageContent || "",
        embeds: data.embeds || [],
        hasAttachments: (data.attachments?.length || 0) > 0,
      }));

      const summarySchema: Schema = {
        type: Type.ARRAY,
        description: "A summary of the conversation",
        items: {
          type: Type.OBJECT,
          properties: {
            heading: {
              type: Type.STRING,
              description:
                "A brief heading summarizing the main point or topic of the conversation segment.",
            },
            content: {
              type: Type.STRING,
              description:
                "A detailed description of the conversation segment, providing more context and information.",
            },
          },
          required: ["heading", "content"],
        },
        maxItems: "25",
        minItems: "1",
      };

      const prompt = `
Generate a summary of the following Discord channel conversation. 
The data contains ${
        summaryData.length
      } messages with timestamps, usernames, and content.
Focus on the main topics, important discussions, and key information shared.
Keep the summary concise but informative, and use markdown formatting where appropriate.

Conversation Data:
${JSON.stringify(summaryData, null, 2)}
      `.trim();

      const contentParts = [...uploadedFiles, prompt];

      const result = await gemini.model!.generateContent({
        model: geminiModel || "gemini-2.0-flash",
        contents: createUserContent(contentParts),
        config: {
          responseMimeType: "application/json",
          responseSchema: summarySchema,
        },
      });

      debugStream.write("Summary generated! Sending follow up...");

      if (!result.text) {
        throw new Error("Failed to generate summary - empty response");
      }

      let summaryItems: SummaryItem[];
      try {
        summaryItems =
          typeof result.text === "string"
            ? JSON.parse(result.text)
            : result.text;
      } catch (parseError) {
        throw new Error(`Failed to parse summary response: ${parseError}`);
      }

      if (!Array.isArray(summaryItems) || summaryItems.length === 0) {
        throw new Error("Invalid summary format received");
      }

      // Ensure each field value is within Discord's limits (1024 characters)
      const processedFields = summaryItems.map((summary, index) => ({
        name: summary.heading.slice(0, 256) || `Summary ${index + 1}`,
        value: summary.content.slice(0, 1024) || "No content available",
        inline: false,
      }));

      const embedMessage = createEmbed({
        color: Colors.Blue,
        title: `📋 Catchup - ${messageNo} Messages`,
        description: `Summary of the last ${dataArray.length} messages in this channel`,
        fields: processedFields,
      });

      await interaction.followUp({
        embeds: [embedMessage],
      });

      debugStream.write("Follow up sent!");
    } catch (error) {
      debugStream.write(`Error occurred: ${error}`);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      try {
        await interaction.followUp({
          content: `❌ Failed to generate summary: ${errorMessage}`,
          ephemeral: true,
        });
      } catch (followUpError) {
        debugStream.write(`Failed to send error message: ${followUpError}`);
      }
    }
  },
};

export default command;
