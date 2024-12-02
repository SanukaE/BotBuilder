import { Client, ActivityType } from 'discord.js';

export default async function (client: Client) {
  client.user?.setActivity({
    name: 'over the server!',
    type: ActivityType.Watching,
  });
}
