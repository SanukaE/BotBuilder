import { Client } from 'discord.js';

export default function (client: Client) {
  console.log(`[System] Logged in as ${client.user?.tag}`);
}
