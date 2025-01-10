import createEmbed from '#utils/createEmbed.js';
import {
  ActionRowBuilder,
  AuditLogEvent,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Colors,
  Guild,
  GuildAuditLogsActionType,
  GuildAuditLogsEntry,
  GuildAuditLogsTargetType,
  User,
} from 'discord.js';
import config from '#config' assert { type: 'json' };

export default async function (
  client: Client,
  auditLogEntry: GuildAuditLogsEntry<
    AuditLogEvent,
    GuildAuditLogsActionType,
    GuildAuditLogsTargetType,
    AuditLogEvent
  >,
  guild: Guild
) {
  const { executorId, targetId, action, reason } = auditLogEntry;

  if (
    action !== AuditLogEvent.MemberBanAdd &&
    action !== AuditLogEvent.MemberBanRemove &&
    action !== AuditLogEvent.MemberKick
  )
    return;

  if (!targetId || !executorId) return;

  const targetUser = await client.users.fetch(targetId);
  const executor = await client.users.fetch(executorId);

  if (targetUser.bot) return;
  const { punishmentAppealLink } = config;

  const embedMessage = createEmbed({
    color:
      action === AuditLogEvent.MemberBanAdd ||
      action === AuditLogEvent.MemberKick
        ? Colors.Red
        : Colors.Green,
    title:
      action === AuditLogEvent.MemberBanAdd ||
      action === AuditLogEvent.MemberKick
        ? 'Punishment Notice'
        : 'Punishment Notice Revoked',
    thumbnail: { url: guild.iconURL() || '' },
  });

  if (
    action === AuditLogEvent.MemberBanAdd ||
    action === AuditLogEvent.MemberKick
  ) {
    embedMessage.setDescription(`
            **Action:** ${
              action === AuditLogEvent.MemberBanAdd ? 'Ban' : 'Kick'
            }
            **Moderator:** ${executor?.displayName} (${executor?.id})
            **Reason:** ${reason || 'No reason provided'}
        `);

    embedMessage.setFields({
      name: 'Appeal:',
      value:
        action === AuditLogEvent.MemberBanAdd ? punishmentAppealLink : 'N/A',
    });
  } else {
    embedMessage.setDescription(`
            **Action:** Ban Revoked
            **Moderator:** ${executor?.displayName} (${executor?.id})
            **Reason:** ${reason || 'No reason provided'}
        `);
  }

  const serverButton = new ButtonBuilder({
    customId: 'punishmentServerButton',
    disabled: true,
    label: `Server: ${guild.name}`,
    style: ButtonStyle.Secondary,
  });
  const actionRow = new ActionRowBuilder<ButtonBuilder>({
    components: [serverButton],
  });

  try {
    await targetUser.send({ embeds: [embedMessage], components: [actionRow] });
  } catch (error) {
    null;
  }
}
