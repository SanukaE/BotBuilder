import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import getConfig from "#utils/getConfig.js";
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
  name: "ticket-user-manage",
  description: "Add/Remove a user from a ticket.",
  isDisabled: !supportConfig.enableTicketSystem,
  options: [
    {
      name: "user",
      description: "The user you want to add/remove to the ticket.",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "action",
      description: "Weather to add or remove the user. Default: Add",
      type: ApplicationCommandOptionType.String,
      choices: [
        { name: "Add User", value: "add" },
        { name: "Remove User", value: "remove" },
      ],
      required: false,
    },
  ],
  permissions: [PermissionFlagsBits.ManageChannels],
  isGuildOnly: true,

  async script(client, interaction, debugStream) {
    const action =
      (interaction.options.getString("action") as "add" | "remove") ?? "add";
    const user = interaction.options.getUser("user", true);

    if (user.bot) {
      await interaction.followUp("You cannot add bot's to tickets.");
      return;
    }

    if (user.id === interaction.user.id) {
      await interaction.followUp("You cannot run this command on yourself.");
      return;
    }

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

    const ticketChannel = (await interaction.channel?.fetch()) as TextChannel;

    if (action === "add") {
      await ticketChannel.permissionOverwrites.edit(user, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        SendVoiceMessages: true,
      });
    } else if (action === "remove") {
      await ticketChannel.permissionOverwrites.edit(user, {
        ViewChannel: false,
      });
    }

    await ticketChannel.sendTyping();
    await ticketChannel.send(
      `${user.displayName} has been ${
        action === "add" ? "added to" : "removed from"
      } the ticket.`
    );

    await interaction.followUp("All done! :)");
  },
};

export default command;
