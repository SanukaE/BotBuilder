import MySQL from "#libs/MySQL.js";
import getConfig from "#utils/getConfig.js";
import saveTicketTranscript from "#utils/saveTicketTranscript.js";
import {
  Client,
  GuildMember,
  PartialGuildMember,
  TextChannel,
} from "discord.js";
import { RowDataPacket } from "mysql2";

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
  member: GuildMember | PartialGuildMember
) {
  const supportConfig = getConfig("support") as SupportConfig;
  if (!supportConfig.closeOnLeave) return;

  const [row] = await MySQL.query<RowDataPacket[]>(
    "SELECT * FROM tickets WHERE ownerID = ?",
    [member.id]
  );
  if (row.length === 0) return;

  const ticketData = row[0];
  const ticketChannel = (await client.channels.fetch(
    ticketData.channelID
  )) as TextChannel;

  await ticketChannel.sendTyping();
  await ticketChannel.send(`This ticket is now closing...`);

  const closeReason = "Ticket owner left the server";

  if (supportConfig.autoSaveTranscripts) {
    await ticketChannel.sendTyping();
    await saveTicketTranscript(client, ticketChannel.id, closeReason);
    await ticketChannel.send("A transcript of this ticket has been saved!");
  }

  const ownerDMChannel = await member.createDM();

  if (ownerDMChannel.isSendable()) {
    await ownerDMChannel.sendTyping();
    await ownerDMChannel.send(
      `Hey ${member.user.displayName}, just want to update on your ${ticketData.category} ticket. It has been closed for ${closeReason}. If your problem hasn't been resolved yet please open a new ticket.`
    );
  }

  await MySQL.query("DELETE FROM tickets WHERE channelID = ?", [
    ticketChannel.id,
  ]);
  await ticketChannel.delete(closeReason);
}
