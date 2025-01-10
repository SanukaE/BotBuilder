import createEmbed from '#utils/createEmbed.js';
import {
  Client,
  Colors,
  Message,
  OmitPartialGroupDMChannel,
  PartialMessage,
} from 'discord.js';

export default async function (
  client: Client,
  message: OmitPartialGroupDMChannel<Message<boolean> | PartialMessage>
) {
  if (message.author?.bot || !message.inGuild()) return;

  const members = message.mentions.members.filter(
    (member) => !member.user.bot && member.id !== message.author.id
  );

  if (!members.size) return;
  await message.channel.sendTyping();

  const embedMessage = createEmbed({
    color: Colors.Red,
    thumbnail: {
      url: 'https://i.postimg.cc/Px5nt9db/cartoon-ghost-icon-png.png',
    },
    title: 'Ghost Ping Detected!',
    description: `${message.author?.displayName} (${
      message.author?.tag
    }) deleted a messaged that mentioned some members.\nThose mentioned members are: ${Array.from(
      members.values()
    )
      .map((member) => member.user.tag)
      .join(', ')}`,
  });

  await message.channel.send({ embeds: [embedMessage] });
}
