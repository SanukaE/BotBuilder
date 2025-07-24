import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import getConfig from "#utils/getConfig.js";
import saveTicketTranscript from "#utils/saveTicketTranscript.js";
import {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
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
};

const supportConfig = getConfig("support") as SupportConfig;

const command: CommandType = {
  name: "ticket-close",
  description: "Closes the ticket the command is run on.",
  isGuildOnly: true,
  isDisabled: !supportConfig.enableTicketSystem,
  options: [
    {
      name: "reason",
      description:
        'Reason for closing the ticket. Default is "Problem Resolved"',
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    {
      name: "save-transcript",
      description:
        "Show a transcript of the ticket be saved. Not setting will use default value.",
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
  ],
  permissions: [PermissionFlagsBits.ManageChannels],

  async script(client, interaction, debugStream) {
    const saveTranscript =
      interaction.options.getBoolean("save-transcript") ??
      supportConfig.autoSaveTranscripts;
    const closeReason =
      interaction.options.getString("reason") ?? "Problem Resolved";

    const [rows] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM tickets WHERE channelID = ?",
      [interaction.channelId]
    );

    if (rows.length === 0) {
      await interaction.followUp(
        "This command can only be run on a ticket channel."
      );
      return;
    }

    const ticketData = rows[0];
    const ticketChannel = (await interaction.channel!.fetch()) as TextChannel;

    await ticketChannel.sendTyping();
    await ticketChannel.send(`This ticket is now closing...`);

    if (saveTranscript) {
      await ticketChannel.sendTyping();
      await saveTicketTranscript(
        client,
        ticketChannel.id,
        closeReason,
        interaction.user.id
      );
      await ticketChannel.send("A transcript of this ticket has been saved!");
    }

    const ownerDMChannel = await interaction.user.createDM();

    if (ownerDMChannel.isSendable()) {
      await ownerDMChannel.sendTyping();
      await ownerDMChannel.send(
        `Hey ${interaction.user.displayName}, just want to update on your ${ticketData.category} ticket. It has been closed for "${closeReason}". If your problem hasn't been resolved yet please open a new ticket.`
      );
    }

    await MySQL.query("DELETE FROM tickets WHERE channelID = ?", [
      ticketChannel.id,
    ]);
    await ticketChannel.delete(closeReason);
  },
};

export default command;
