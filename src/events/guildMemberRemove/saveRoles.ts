import { Client, GuildMember, PartialGuildMember } from 'discord.js';
import getConfig from '#utils/getConfig.js';
import MySQL from '#libs/MySQL.js';

export default async function (
  _: Client,
  member: GuildMember | PartialGuildMember
) {
  const { memberRoleID, botRoleID, stickyRoles } = getConfig("moderation") as { memberRoleID: string; botRoleID: string; stickyRoles: boolean };
  if (!stickyRoles) return;

  const roleIDs = member.roles.cache
    .filter((role) => role.id !== memberRoleID && role.id !== botRoleID)
    .map((role) => role.id);

  await MySQL.query(
    'INSERT INTO user_roles (userID, roles) VALUES (?, ?) ON DUPLICATE KEY UPDATE roles = ?',
    [member.id, JSON.stringify(roleIDs), JSON.stringify(roleIDs)]
  );
}
