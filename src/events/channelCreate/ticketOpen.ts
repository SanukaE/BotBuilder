import Gemini from "#libs/Gemini.js";
import MySQL from "#libs/MySQL.js";
import createEmbed from "#utils/createEmbed.js";
import getAllFiles from "#utils/getAllFiles.js";
import getConfig from "#utils/getConfig.js";
import { Schema, SendMessageParameters, Type } from "@google/genai";
import { Client, NonThreadGuildBasedChannel, TextChannel } from "discord.js";
import { RowDataPacket } from "mysql2";
import path from "path";
import fs from "fs";
import { BuiltInGraphemeProvider } from "canvacord";

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
  const supportConfig = getConfig("support") as SupportConfig;
  if (!supportConfig.helpUserWithTicket) return;

  await new Promise((resolve) => setTimeout(resolve, 3000)); //3sec delay

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

  const [categoryName, supportTeamRoleID, formTitle] =
    supportConfig.ticketCategories
      .find((cat) => cat.startsWith(ticketData.category))!
      .split(":");

  const supportTeamRole = await channel.guild.roles.fetch(supportTeamRoleID);
  if (!supportTeamRole) return;

  const gemini = Gemini();
  if (!gemini.enabled) return;

  const { geminiModel } = getConfig("ai") as { geminiModel: string };

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
        mimeType: "text/plain",
      },
    });

    transcriptFiles.push({
      fileData: {
        fileUri: fileUpload.uri,
        mimeType: fileUpload.mimeType,
      },
    });
  }

  let startingContent: any = [
    { text: `Help me with the information I have provided.` },
  ];

  if (ticketData.formData)
    startingContent.push({
      text:
        typeof ticketData.formData === "string"
          ? ticketData.formData
          : JSON.stringify(ticketData.formData),
    });
  if (transcriptFiles.length > 0) startingContent.push(...transcriptFiles);

  const faqPath = path.join(process.cwd(), "public/faqAnswers.txt");
  if (fs.existsSync(faqPath)) {
    const fileUpload = await gemini.fileManager!.upload({
      file: faqPath,
      config: {
        mimeType: "text/plain",
      },
    });

    startingContent.push({
      fileData: {
        fileUri: fileUpload.uri,
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
            text: `Hey ${ticketOwner.displayName}, while you wait for a support member let me try help you. Can you tell me why you opened this ticket? If you don't need my help please say "\`I don't need your help\`"`,
          },
        ],
      },
    ],
    config: {
      systemInstruction:
        "Your helping a user who has opened a ticket until a support member looks at the ticket.",
      tools: [{ urlContext: {} }, { googleSearch: {} }],
      maxOutputTokens: 500,
    },
  });

  await ticketChannel.sendTyping();
  await ticketChannel.send(
    `Hey ${ticketOwner.displayName}, while you wait for a support member let me try help you. Can you tell me why you opened this ticket? If you don't need my help please say "\`I don't need your help\`"`
  );

  const collector = ticketChannel.createMessageCollector({
    filter: (msg) => !msg.author.bot,
  });

  collector.on("collect", async (message) => {
    try {
      await ticketChannel.sendTyping();

      if (supportTeamRole.members.has(message.author.id)) {
        await ticketChannel.send(
          `Since ${message.author.displayName} is here, I'll let him/her take care of this this ticket. Bye ${ticketOwner.displayName}!`
        );

        if (supportConfig.autoClaimTicket) {
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

      if (
        message.content &&
        message.content.toLowerCase() === "i don't need your help"
      ) {
        await ticketChannel.send(
          `Got it ${message.author.displayName}. Hope I keep you entertained.`
        );
        collector.stop();
        return;
      }

      let messageContent: SendMessageParameters["message"][] = [];

      if (message.content) messageContent.push({ text: message.content });

      for (const attachment of Array.from(message.attachments.values())) {
        const fileResponse = await fetch(attachment.url);
        const fileBuffer = await fileResponse.arrayBuffer();
        const fileBlob = new Blob([fileBuffer], {
          type: attachment.contentType ?? "text/plain",
        });

        const fileUpload = await gemini.fileManager!.upload({
          file: fileBlob,
        });

        messageContent.push({
          fileData: {
            fileUri: fileUpload.uri,
            mimeType: fileUpload.mimeType,
          },
        });
      }

      const response = await chat.sendMessage({
        message: messageContent,
      } as any);

      if (!response.text) {
        await ticketChannel.send("Sorry but I don't what to say to that.");
        return;
      }

      await ticketChannel.send(response.text);
    } catch (error: any) {
      console.log(
        `[Error] Failed to support user with ticket: ${error.message}`
      );
    }
  });
}
