import express, { Router, type NextFunction, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import {
  DownloadXStorePlatformBackupResponse,
  GetXStorePlatformBackupSummaryResponse,
  RestoreXStorePlatformBackupBody,
  RestoreXStorePlatformBackupResponse,
} from "@workspace/api-zod";
import { db, xstoreAuditLogs, xstoreUsers } from "@workspace/db";
import { denyRole, getXStoreUser, requireXStoreUser } from "../middlewares/xstoreAuth";
import { clearSessionCookie } from "../lib/xstore-session";
import {
  createXStorePlatformBackup,
  getXStorePlatformBackupSummary,
  MAX_XSTORE_PLATFORM_BACKUP_BYTES,
  PlatformBackupError,
  restoreXStorePlatformBackup,
} from "../lib/xstore-platform-backup";

const router = Router();
const BACKUP_MEDIA_TYPE = "application/vnd.xstore.platform-backup+json";
const MAX_RESTORE_REQUEST_BYTES = MAX_XSTORE_PLATFORM_BACKUP_BYTES + 1024;
const RESTORE_CONFIRMATION = "استعادة المنصة";
const backupTextParser = express.text({
  type: BACKUP_MEDIA_TYPE,
  limit: MAX_RESTORE_REQUEST_BYTES,
});

router.use("/xstore/platform-backup", requireXStoreUser);

function parseBackupText(req: Request, res: Response, next: NextFunction): void {
  backupTextParser(req, res, (error?: unknown) => {
    if (!error) {
      next();
      return;
    }
    const parserError = error as { type?: string; status?: number };
    if (parserError.type === "entity.too.large" || parserError.status === 413) {
      res.status(413).json({
        error: "ملف النسخة أكبر من الحد المسموح به وهو 128 ميبيبايت.",
      });
      return;
    }
    req.log.warn({ error }, "Unable to read platform backup upload");
    res.status(400).json({ error: "تعذر قراءة ملف النسخة الاحتياطية." });
  });
}

function requirePlatformOwner(res: Response): boolean {
  return denyRole(res, getXStoreUser(res), ["platform_admin"]);
}

function isDatabaseConstraintError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return (
    typeof code === "string" &&
    ["22P02", "22003", "22007", "23502", "23503", "23505", "42804"].includes(code)
  );
}

async function writeRestoreAudit(
  req: Request,
  actor: ReturnType<typeof getXStoreUser>,
  restoredRowCount: number,
  restoredAt: Date,
): Promise<void> {
  try {
    const [existingActor] = await db
      .select({ id: xstoreUsers.id })
      .from(xstoreUsers)
      .where(eq(xstoreUsers.id, actor.id))
      .limit(1);
    await db.insert(xstoreAuditLogs).values({
      actorUserId: existingActor?.id ?? null,
      actorName: actor.name,
      action: "platform_backup_restored",
      tenantId: null,
      entityType: "platform_backup",
      entityId: null,
      details: `تمت استعادة نسخة بتاريخ ${restoredAt.toISOString()} وتضمنت ${restoredRowCount} سجلاً.`,
    });
  } catch (error) {
    req.log.error({ error }, "Unable to record platform backup restore audit event");
  }
}

function platformOwnerOnly(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (requirePlatformOwner(res)) return;
  next();
}

router.get("/xstore/platform-backup/summary", async (req, res) => {
  if (requirePlatformOwner(res)) return;
  try {
    const summary = GetXStorePlatformBackupSummaryResponse.parse(
      await getXStorePlatformBackupSummary(),
    );
    res.json(summary);
  } catch (error) {
    req.log.error({ error }, "Unable to summarize X-Store platform backup");
    res.status(500).json({ error: "تعذر قراءة بيانات النسخ الاحتياطي." });
  }
});

router.get("/xstore/platform-backup", async (req, res) => {
  if (requirePlatformOwner(res)) return;
  try {
    const backup = DownloadXStorePlatformBackupResponse.parse(
      await createXStorePlatformBackup(),
    );
    const timestamp = backup.createdAt
      .toISOString()
      .replaceAll(":", "-")
      .replaceAll(".", "-");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="xstore-platform-backup-${timestamp}.json"`,
    );
    res.json(backup);
  } catch (error) {
    if (error instanceof PlatformBackupError) {
      req.log.warn({ error }, "X-Store platform backup exceeds the download limit");
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    req.log.error({ error }, "Unable to create X-Store platform backup");
    res.status(500).json({ error: "تعذر إنشاء النسخة الاحتياطية." });
  }
});

router.post(
  "/xstore/platform-backup/restore",
  platformOwnerOnly,
  parseBackupText,
  async (req, res) => {
    if (typeof req.body !== "string") {
      res.status(400).json({ error: "ملف النسخة الاحتياطية غير صالح." });
      return;
    }

    let input: unknown;
    try {
      input = JSON.parse(req.body);
    } catch {
      res.status(400).json({ error: "الملف ليس نسخة احتياطية بصيغة JSON صحيحة." });
      return;
    }

    const validatedInput = RestoreXStorePlatformBackupBody.safeParse(input);
    if (!validatedInput.success) {
      res.status(400).json({
        error: "تنسيق ملف النسخة غير صالح أو لا يطابق إصدار X-Store الحالي.",
      });
      return;
    }
    if (validatedInput.data.confirmation !== RESTORE_CONFIRMATION) {
      res.status(400).json({
        error: `اكتب «${RESTORE_CONFIRMATION}» لتأكيد استبدال بيانات المنصة.`,
      });
      return;
    }

    try {
      const actor = getXStoreUser(res);
      const result = RestoreXStorePlatformBackupResponse.parse(
        await restoreXStorePlatformBackup(validatedInput.data.backup),
      );
      await writeRestoreAudit(req, actor, result.restoredRowCount, result.restoredAt);
      clearSessionCookie(res);
      res.json(result);
    } catch (error) {
      if (error instanceof PlatformBackupError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      if (isDatabaseConstraintError(error)) {
        req.log.warn({ error }, "Platform backup data conflicts with the current schema");
        res.status(409).json({
          error: "البيانات داخل النسخة لا تتوافق مع قاعدة البيانات الحالية. لم يتم اعتماد أي تغيير.",
        });
        return;
      }
      req.log.error({ error }, "Unable to restore X-Store platform backup");
      res.status(500).json({
        error: "تعذرت استعادة النسخة. لم يتم اعتماد أي تغييرات غير مكتملة.",
      });
    }
  },
);

export default router;
