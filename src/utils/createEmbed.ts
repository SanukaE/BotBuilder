import { EmbedBuilder, EmbedData, APIEmbed } from 'discord.js';

//TODO: add icon & remove branding if premium

export default function (data?: EmbedData | APIEmbed) {
  return new EmbedBuilder({
    author: {
      name: 'Powered by BotBuilder',
      url: 'https://github.com/SanukaE/BotBuilder',
      //iconURL: ""
    },

    ...data,

    footer: {
      text: 'BotBuilder, the future of Discord Bots.',
      //iconURL: '',
    },
  });
}
