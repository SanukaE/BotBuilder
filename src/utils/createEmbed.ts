import { EmbedBuilder } from 'discord.js';

//TODO: add icon to author & remove branding if premium

export default function () {
  return new EmbedBuilder({
    author: {
      name: 'Powered by BotBuilder',
      url: 'https://github.com/SanukaE/BotBuilder',
      //iconURL: ""
    },

    footer: {
      text: 'Made with ❤️ by ItzSanuka',
      iconURL: 'https://i.postimg.cc/htzSdpnj/current-pfp.jpg',
    },
  });
}
