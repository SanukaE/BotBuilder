import MySQL from "#libs/MySQL.js";
import { Client, TextChannel } from "discord.js";
import { RowDataPacket } from "mysql2";
import fs from "fs";
import path from "path";
import Gemini from "#libs/Gemini.js";
import getConfig from "./getConfig.js";

export default async function (
  client: Client,
  channelID: string,
  closeReason: string,
  staffID?: string
) {
  const ticketChannel = (await client.channels.fetch(channelID)) as TextChannel;

  const [rows] = await MySQL.query<RowDataPacket[]>(
    "SELECT * FROM tickets WHERE channelID = ?",
    [channelID]
  );
  const ticketData = rows[0];

  const owner = await client.users.fetch(ticketData.ownerID);
  const staff = staffID ? await client.users.fetch(staffID) : "System";
  const claimedUser = ticketData.claimedBy
    ? await client.users.fetch(ticketData.claimedBy)
    : "No One";

  let dataContent = `General Information\n\nTicket Category: ${
    ticketData.category
  }\nTicket Open at: ${ticketChannel.createdAt.toLocaleString()}\nTranscript Save at: ${new Date().toLocaleString()}\nOpened By: ${
    owner.displayName
  } (${owner.username})\nClosed By: ${
    typeof staff === "string"
      ? staff
      : `${staff.displayName} (${staff.username})`
  }\nClose Reason: ${closeReason}\nClaimed By: ${
    typeof claimedUser === "string"
      ? claimedUser
      : `${claimedUser.displayName} (${claimedUser.username})`
  }`;

  let formData = `Form Filled\n\n`;

  if (ticketData.formData) {
    const ticketFormData =
      typeof ticketData.formData === "string"
        ? JSON.parse(ticketData.formData)
        : ticketData.formData;

    Object.entries(ticketFormData).forEach(([key, value]) => {
      formData += `${key}: ${value}\n`;
    });
  } else {
    formData += "The user did not fill in a form when opening the ticket.";
  }

  let messages = `Ticket Conversation\n\n`;

  // Fetch all messages from the ticket channel (no limit)
  let allMessages = [];
  let lastMessageID = null;

  while (true) {
    const options: { limit?: number; before?: string } = { limit: 100 };
    if (lastMessageID) {
      options.before = lastMessageID;
    }

    const fetchedMessages = await ticketChannel.messages.fetch(options);

    if (fetchedMessages.size === 0) {
      break; // No more messages to fetch
    }

    allMessages.push(...Array.from(fetchedMessages.values()));
    lastMessageID = fetchedMessages.last()?.id;
  }

  // Sort by oldest first for proper transcript order
  allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  // Filter out the last message if it's from a bot
  const messagesToProcess = allMessages.filter((msg, index) => {
    // If it's the last message and it's from a bot, exclude it
    if (index === allMessages.length - 1 && msg.author.bot) {
      return false;
    }
    return true;
  });

  // Format messages according to a format
  for (const message of messagesToProcess) {
    if (
      !message.content &&
      !message.embeds.length &&
      !message.attachments.size &&
      !message.stickers.size
    ) {
      continue; // Skip empty messages
    }

    const author =
      message.member?.displayName ||
      message.author.displayName ||
      message.author.username;
    const timestamp = message.createdAt.toLocaleString();

    messages += `[${author} at ${timestamp}]:\n`;

    // Add message content
    if (message.content) {
      messages += `Message: ${message.content}\n`;
    }

    // Add embeds if present
    if (message.embeds && message.embeds.length > 0) {
      const embedTitles = message.embeds
        .map((embed) => embed.title || "Untitled Embed")
        .join(", ");
      messages += `Embeds: ${embedTitles}\n`;
    }

    // Add files/attachments if present
    if (message.attachments && message.attachments.size > 0) {
      const fileNames = Array.from(message.attachments.values())
        .map((attachment) => attachment.name)
        .join(", ");
      messages += `Files: ${fileNames}\n`;
    }

    // Add stickers if present
    if (message.stickers && message.stickers.size > 0) {
      const stickerNames = Array.from(message.stickers.values())
        .map((sticker) => sticker.name)
        .join(", ");
      messages += `Stickers: ${stickerNames}\n`;
    }

    messages += "\n"; // Add spacing between messages
  }

  const { geminiModel } = getConfig("ai") as { geminiModel: string };
  const gemini = Gemini();
  let ticketSummary = `Ticket Summary\n\n`;

  if (gemini.enabled) {
    const result = await gemini.model!.generateContent({
      model: geminiModel || "gemini-2.5-flash",
      contents: `Summarize this ticket conversation:\n\n${messages}`,
      config: {
        tools: [{ urlContext: {} }, { googleSearch: {} }],
        systemInstruction:
          "Provide the answer in plain text only, no formatting",
        maxOutputTokens: 1000,
      },
    });
    ticketSummary += result.text ?? "Failed to generate summary.";
  } else
    ticketSummary += "AI is disabled and cannot be used to generate a summary.";

  const transcriptPath = path.join(
    process.cwd(),
    "localData",
    "ticketTranscripts",
    ticketData.category
  );
  if (!fs.existsSync(transcriptPath))
    fs.mkdirSync(transcriptPath, { recursive: true });

  const ticketTranscript = `${dataContent}\n\n\n${formData}\n\n\n${ticketSummary}\n\n\n${messages}`;

  fs.writeFileSync(
    path.join(transcriptPath, `${owner.username}-${channelID}.txt`),
    ticketTranscript
  );
}
