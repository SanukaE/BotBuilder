import { Client, APIApplicationCommandOption } from 'discord.js';
import CommandType from '#types/CommandType.js';

export default async function (client: Client) {
  try {
    // Retrieve global commands
    const globalCommands = await client.application!.commands.fetch();

    // Convert global commands to CommandType array
    const slashCommands: CommandType[] = globalCommands.map((command) => ({
      id: command.id,
      name: command.name,
      description: command.description,
      options: command.options as APIApplicationCommandOption[],
    }));

    return slashCommands;
  } catch (error) {
    throw error;
  }
}
