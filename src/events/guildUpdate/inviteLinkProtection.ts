import getConfig from "#utils/getConfig.js";
import { AuditLogEvent, Client, Guild } from "discord.js";

export default async function (
  client: Client,
  oldGuild: Guild,
  newGuild: Guild
) {
  const { inviteLinkProtection } = getConfig("moderation") as {
    inviteLinkProtection: boolean;
  };
  if (
    !inviteLinkProtection ||
    oldGuild.vanityURLCode === newGuild.vanityURLCode
  )
    return;

  const auditLogs = await newGuild.fetchAuditLogs({
    type: AuditLogEvent.GuildUpdate,
    limit: 1,
  });
  const entry = auditLogs.entries.first();
  if (!entry) return;

  const executor = entry.executor;
  if (!executor || executor.id === newGuild.ownerId) return;

  const owner = await newGuild.fetchOwner();
  if (owner) {
    owner
      .send(
        `The server's vanity URL was changed by ${executor.tag} (${executor.id}). Please review this change.`
      )
      .catch(() => {
        console.error(
          "[Error] Failed to send DM to the server owner about vanity URL change."
        );
      });
  }
}
