import MySQL from '#libs/MySQL.js';
import { Client, Message, OmitPartialGroupDMChannel } from 'discord.js';
import { RowDataPacket } from 'mysql2';

export default async function(client: Client, message: OmitPartialGroupDMChannel<Message<boolean>>) {
    if(message.author.bot) return;

    const [rows] = await MySQL.query<RowDataPacket[]>('SELECT afkMessage FROM afk_users WHERE userID = ?', [message.author.id]);

    if (!rows.length) return;

    await MySQL.query('DELETE FROM afk_users WHERE userID = ?', [message.author.id]);

    try {
        await message.author.send('Your AFK status has been removed because you sent a message.');
    } catch {
        null;
    }
}