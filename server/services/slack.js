import { WebClient } from '@slack/web-api';

export function getSlackClient() {
  if (!process.env.SLACK_BOT_TOKEN) throw new Error('SLACK_BOT_TOKEN is not set');
  return new WebClient(process.env.SLACK_BOT_TOKEN);
}

export function getBlacklist() {
  return (process.env.SLACK_BLACKLIST_CHANNELS || '').split(',').filter(Boolean);
}

export async function getAuthInfo() {
  const client = getSlackClient();
  return client.auth.test();
}

export async function getJoinedChannels() {
  const client = getSlackClient();
  const blacklist = getBlacklist();

  const [convResult, imResult] = await Promise.all([
    client.conversations.list({
      types: 'public_channel,private_channel,mpim',
      exclude_archived: true,
      limit: 200,
    }),
    client.conversations.list({
      types: 'im',
      exclude_archived: true,
      limit: 100,
    }),
  ]);

  const all = [...(convResult.channels || []), ...(imResult.channels || [])];

  return all
    .filter(c => c.is_member !== false)
    .map(c => ({
      id: c.id,
      name: c.name || c.user || c.id,
      type: c.is_im ? 'dm' : c.is_mpim ? 'group_dm' : c.is_private ? 'private' : 'public',
      isBlacklisted: blacklist.includes(c.id),
    }));
}

export async function getChannelMessagesLast24h(channelId) {
  const client = getSlackClient();
  const oldest = String(Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000));

  try {
    const result = await client.conversations.history({
      channel: channelId,
      oldest,
      limit: 50,
    });
    return result.messages || [];
  } catch (err) {
    // Bot not in channel — skip silently
    if (err.data?.error === 'not_in_channel') return [];
    throw err;
  }
}

export async function fetchDigestData(botUserId) {
  const channels = await getJoinedChannels();
  const active = channels.filter(c => !c.isBlacklisted);

  const channelDigests = await Promise.all(
    active.map(async ch => {
      const messages = await getChannelMessagesLast24h(ch.id);
      const hasMention = messages.some(m => m.text?.includes(`<@${botUserId}>`));
      return { ...ch, messages, hasMention, messageCount: messages.length };
    })
  );

  return channelDigests.filter(ch => ch.messageCount > 0);
}
