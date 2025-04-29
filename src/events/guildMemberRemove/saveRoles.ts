import { Client, GuildMember, PartialGuildMember } from 'discord.js';
import config from '#config' with { type: 'json' };
import MySQL from '#libs/MySQL.js';

export default async function (
  _: Client,
  member: GuildMember | PartialGuildMember
) {
  const { enableStickyRoles, memberRoleID, botRoleID } = config;
  if (!enableStickyRoles) return;

  const roleIDs = member.roles.cache
    .filter((role) => role.id !== memberRoleID && role.id !== botRoleID && role.id !== member.guild.id)
    .map((role) => role.id);
  
  await MySQL.query(
    'INSERT INTO user_roles (userID, roles) VALUES (?, ?) ON DUPLICATE KEY UPDATE roles = ?',
    [member.id, JSON.stringify(roleIDs), JSON.stringify(roleIDs)]
  );
}
