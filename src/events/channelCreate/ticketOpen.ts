import Gemini from "#libs/Gemini.js";
import MySQL from "#libs/MySQL.js";
import createEmbed from "#utils/createEmbed.js";
import getAllFiles from "#utils/getAllFiles.js";
import getConfig from "#utils/getConfig.js";
import { Schema, Type } from "@google/genai";
import { Client, NonThreadGuildBasedChannel, TextChannel } from "discord.js";
import { RowDataPacket } from "mysql2";
import path from "path";
import fs from "fs";

type SupportConfig = {
  supportChannelID: string;
  enableTicketSystem: boolean;
  ticketCategoryID: string;
  ticketCategories: string[];
  ticketWelcomeMessage: string;
  autoCloseTicketsAfter: number;
  mentionSupportTeam: boolean;
  autoSaveTranscripts: boolean;
  helpUserWithTicket: boolean;
  allowMultipleTickets: boolean;
  autoClaimTicket: boolean;
  closeOnLeave: boolean;
};

export default async function (
  client: Client,
  channel: NonThreadGuildBasedChannel
) {
  const [rows] = await MySQL.query<RowDataPacket[]>(
    "SELECT * FROM tickets WHERE channelID = ?",
    [channel.id]
  );
  if (rows.length === 0) return;

  const ticketData = rows[0];
  const ticketOwner = await client.users.fetch(ticketData.ownerID);
  const ticketChannel = (await client.channels.fetch(
    ticketData.channelID
  )) as TextChannel;
  if (!ticketChannel) return;

  const supportConfig = getConfig("support") as SupportConfig;
  if (!supportConfig.helpUserWithTicket) return;

  const [categoryName, supportTeamRoleID, formTitle] =
    supportConfig.ticketCategories
      .find((cat) => cat.startsWith(ticketData.category))!
      .split(":");

  const supportTeamRole = await channel.guild.roles.fetch(supportTeamRoleID);
  if (!supportTeamRole) return;

  const gemini = Gemini();
  if (!gemini.enabled) return;

  const { geminiModel } = getConfig("ai") as { geminiModel: string };

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      canHelp: {
        type: Type.BOOLEAN,
        description: "Weather or not you can help the user.",
        example: true,
      },
      messageType: {
        type: Type.STRING,
        description:
          "What the message type you want to reply with. (normal message or an embed)",
        enum: ["NORMAL", "EMBED", "BOTH"],
        example: "NORMAL",
      },
      messageContent: {
        type: Type.STRING,
        description:
          "If the reply is a message, then this is for the content of the message.",
      },
      embedData: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "This is the embed title.",
          },
          description: {
            type: Type.STRING,
            description: "This is the embed description.",
          },
          fields: {
            type: Type.ARRAY,
            items: {
              properties: {
                name: {
                  type: Type.STRING,
                  description: "This is the embed field name.",
                },
                value: {
                  type: Type.STRING,
                  description: "This is the embed field value.",
                },
              },
              required: ["name", "value"],
            },
            maxItems: "25",
            minItems: "1",
          },
        },
        required: ["title", "description"],
      },
    },
    required: ["canHelp"],
  };

  const previousTranscriptsPaths = getAllFiles(
    path.join(
      process.cwd(),
      "localData",
      "ticketTranscripts",
      ticketData.category
    )
  );

  let transcriptFiles = [];
  for (const transcriptPath of previousTranscriptsPaths) {
    const fileUpload = await gemini.fileManager!.upload({
      file: transcriptPath,
      config: {
        displayName: path.basename(transcriptPath, ".txt"),
        mimeType: "text/plain",
      },
    });

    transcriptFiles.push({
      fileData: {
        fileUri: fileUpload.uri,
        displayName: fileUpload.displayName,
        mimeType: fileUpload.mimeType,
      },
    });
  }

  let startingContent: any = [
    { text: `Help me with the information I have provided.` },
  ];

  if (ticketData.formData) startingContent.push({ text: ticketData.formData });
  if (transcriptFiles.length > 0) startingContent.push(...transcriptFiles);

  const faqPath = path.join(process.cwd(), "public/faqAnswers.txt");
  if (fs.existsSync(faqPath)) {
    const fileUpload = await gemini.fileManager!.upload({
      file: faqPath,
      config: {
        displayName: path.basename(faqPath, ".txt"),
        mimeType: "text/plain",
      },
    });

    startingContent.push({
      fileData: {
        fileUri: fileUpload.uri,
        displayName: fileUpload.displayName,
        mimeType: fileUpload.mimeType,
      },
    });
  }

  const chat = gemini.chat!.create({
    model: geminiModel || "gemini-2.5-flash",
    history: [
      {
        role: "user",
        parts: startingContent,
      },
      {
        role: "model",
        parts: [
          {
            text: `Hey ${ticketOwner.displayName}, while you wait for a support member let me try help you. Can you tell me why you opened this ticket?`,
          },
        ],
      },
    ],
    config: {
      systemInstruction:
        "Your helping a user who has opened a ticket until a support member looks at the ticket.",
      tools: [{ urlContext: {} }, { googleSearch: {} }],
      responseJsonSchema: responseSchema,
      responseMimeType: "application/json",
      maxOutputTokens: 500,
    },
  });

  await ticketChannel.sendTyping();
  await ticketChannel.send(
    `Hey ${ticketOwner.displayName}, while you wait for a support member let me try help you. Can you tell me why you opened this ticket?`
  );

  const collector = ticketChannel.createMessageCollector({
    filter: (msg) => !msg.author.bot,
  });

  collector.on("collect", async (message) => {
    try {
      if (supportTeamRole.members.has(message.author.id)) {
        await ticketChannel.sendTyping();
        await ticketChannel.send(
          `Since ${message.author.displayName} is here, I'll let him/her take care of this this ticket. Bye ${ticketOwner.displayName}!`
        );

        if (supportConfig.autoClaimTicket) {
          await ticketChannel.sendTyping();
          await ticketChannel.send(
            `This ticket is now claimed by <@${message.author.id}>!`
          );
          await MySQL.query(
            "UPDATE tickets SET claimedBy = ? WHERE channelID = ?",
            [message.author.id, ticketChannel.id]
          );
        }

        collector.stop();
        return;
      }

      const response = await chat.sendMessage({ message: message.content });

      if (!response.text) {
        await ticketChannel.sendTyping();
        await ticketChannel.send("Sorry but I don't what to say to that.");
        return;
      }

      const responseData = JSON.parse(response.text);

      if (!responseData.canHelp) {
        await ticketChannel.sendTyping();
        await ticketChannel.send(
          "Sorry I cannot help you further from here. Please wait for a support member to show up."
        );
        collector.stop();
        return;
      }

      switch (responseData.messageType) {
        case "NORMAL":
          await ticketChannel.sendTyping();
          await ticketChannel.send(responseData.messageContent);
          break;

        case "EMBED":
          await ticketChannel.sendTyping();
          await ticketChannel.send({
            embeds: [
              createEmbed({
                title: responseData.embedData.title,
                description: responseData.embedData.description,
                fields: responseData.embedData.fields,
              }),
            ],
          });
          break;

        case "BOTH":
          await ticketChannel.sendTyping();
          await ticketChannel.send({
            content: responseData.messageContent,
            embeds: [
              createEmbed({
                title: responseData.embedData.title,
                description: responseData.embedData.description,
                fields: responseData.embedData.fields,
              }),
            ],
          });
          break;
      }
    } catch (error: any) {
      console.log(
        `[Error] Failed to support user with ticket: ${error.message}`
      );
    }
  });
}
