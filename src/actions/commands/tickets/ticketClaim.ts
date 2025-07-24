import MySQL from "#libs/MySQL.js";
import CommandType from "#types/CommandType.js";
import getConfig from "#utils/getConfig.js";
import { PermissionFlagsBits, TextChannel } from "discord.js";
import { RowDataPacket } from "mysql2";

const supportConfig = getConfig("support") as any;

const command: CommandType = {
  name: "ticket-claim",
  description: "Claim an open ticket.",
  isGuildOnly: true,
  permissions: [PermissionFlagsBits.ManageChannels],
  isDisabled: !supportConfig.enableTicketSystem,

  async script(client, interaction, debugStream) {
    const [row] = await MySQL.query<RowDataPacket[]>(
      "SELECT * FROM tickets WHERE channelID = ?",
      [interaction.channelId]
    );

    if (row.length === 0) {
      await interaction.followUp(
        "Please run this command on a ticket channel."
      );
      return;
    }

    const ticketData = row[0];

    if (ticketData.claimedBy) {
      const claimUser = await client.users.fetch(ticketData.claimedBy);
      await interaction.followUp(
        `This ticket has already being claimed by ${claimUser.displayName} (${claimUser.username})`
      );
      return;
    }

    await MySQL.query("UPDATE tickets SET claimedBy = ? WHERE channelID = ?", [
      interaction.user.id,
      interaction.channelId,
    ]);
    await interaction.followUp("You have successfully claimed this ticket.");

    const ticketChannel = interaction.channel as TextChannel;

    await ticketChannel.sendTyping();
    await ticketChannel.send(
      `This ticket is now claimed by <@${interaction.user.id}>!`
    );

    const ticketOwner = await client.users.fetch(ticketData.ownerID);

    try {
      await ticketOwner.send(
        `Hey ${ticketOwner.displayName}, I just want to update you on your ${ticketData.category} ticket. Your ticket has being claimed by ${interaction.user.displayName}`
      );
    } catch (err) {
      null;
    }
  },
};

export default command;
