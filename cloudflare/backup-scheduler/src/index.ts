export interface Env {
  XSTORE_PRODUCTION_URL: string;
  CRON_SECRET: string;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const url = `${env.XSTORE_PRODUCTION_URL.replace(/\\/$/, "")}/api/xstore/platform-backup/auto-run`;

    ctx.waitUntil(
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CRON_SECRET}`,
          "Content-Type": "application/json",
          "User-Agent": "X-Store-Cloudflare-Backup-Scheduler",
        },
      }).then(async (response) => {
        const body = await response.text();
        if (!response.ok) {
          throw new Error(`Backup scheduler request failed (${response.status}): ${body}`);
        }
      }),
    );
  },
};
