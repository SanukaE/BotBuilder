import { Client, GuildMember } from 'discord.js';
import config from '#config' with { type: 'json' };
import MySQL from '#libs/MySQL.js';
import { RowDataPacket } from 'mysql2';

export default async function (_: Client, member: GuildMember) {
  const { memberRoleID, botRoleID, enableStickyRoles } = config;

  try {
    if (!member.user.bot && memberRoleID)
      await member.roles.add(memberRoleID, 'Auto Role');
    else if (member.user.bot && botRoleID)
      await member.roles.add(botRoleID, 'Auto Role');

    if (!enableStickyRoles) return;

    const [result] = await MySQL.query<RowDataPacket[]>(
      'SELECT roles FROM user_roles WHERE userID = ?',
      [member.id]
    );

    if (!result[0].roles) return;

    const userRoles = JSON.parse(result[0].roles as string);

    for (const roleID of userRoles) {
      await member.roles.add(roleID, 'Sticky Role');
    }

    await MySQL.query('DELETE FROM user_roles WHERE userID = ?', [member.id]);
  } catch (error: any) {
    console.log(`[Error] ${error.message || error}`);
  }
}
