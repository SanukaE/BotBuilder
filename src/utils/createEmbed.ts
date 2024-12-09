import { EmbedBuilder } from 'discord.js';

//TODO: add icon & remove branding if premium

export default function () {
  return new EmbedBuilder({
    author: {
      name: 'Powered by BotBuilder',
      url: 'https://github.com/SanukaE/BotBuilder',
      //iconURL: ""
    },

    footer: {
      text: 'BotBuilder, the future of Discord Bots.',
      //iconURL: '',
    },
  });
}
