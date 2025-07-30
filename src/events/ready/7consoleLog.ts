import { Client } from 'discord.js';

export default function (client: Client) {
  console.log(`[System] ${client.user?.displayName} is ready!`);
}
