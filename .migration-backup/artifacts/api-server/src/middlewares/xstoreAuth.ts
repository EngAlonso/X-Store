import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db, xstoreTenants, xstoreUsers, type XStoreUser } from "@workspace/db";
import { readSessionToken } from "../lib/xstore-session";

declare global {
  namespace Express {
    interface Locals {
      xstoreUser?: XStoreUser;
    }
  }
}

export async function requireXStoreUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const localSession = readSessionToken(req);
    if (localSession) {
      const [localUser] = await db
        .select()
        .from(xstoreUsers)
        .where(eq(xstoreUsers.id, localSession.userId))
        .limit(1);
      if (
        !localUser ||
        !localUser.isActive ||
        !localUser.passwordHash ||
        localUser.sessionVersion !== localSession.sessionVersion
      ) {
        res.status(401).json({ error: "Your session has expired. Sign in again." });
        return;
      }
      if (!(await ensureXStoreTenantAccess(localUser, req, res))) return;
      res.locals.xstoreUser = localUser;
      next();
      return;
    }

    res.status(401).json({ error: "Sign in with your phone number and password." });
  } catch (error) {
    req.log.error({ error }, "Unable to resolve X-Store identity");
    res.status(500).json({ error: "Unable to load the X-Store account." });
  }
}

export async function ensureXStoreTenantAccess(
  user: XStoreUser,
  req: Request,
  res: Response,
): Promise<boolean> {
  if (user.tenantId && user.role !== "platform_admin") {
    const [tenant] = await db
      .select({
        status: xstoreTenants.status,
        plan: xstoreTenants.plan,
        subscriptionEndsAt: xstoreTenants.subscriptionEndsAt,
      })
      .from(xstoreTenants)
      .where(eq(xstoreTenants.id, user.tenantId))
      .limit(1);
    const today = new Date().toISOString().slice(0, 10);
    const expired =
      tenant?.plan !== "lifetime" &&
      tenant?.subscriptionEndsAt !== null &&
      tenant?.subscriptionEndsAt !== undefined &&
      tenant.subscriptionEndsAt < today;
    if (!tenant || tenant.status === "suspended" || expired) {
      req.log.warn(
        { userId: user.id, tenantId: user.tenantId },
        "Blocked access to inactive X-Store tenant",
      );
      res.status(403).json({
        error: "حساب هذا المتجر موقوف أو انتهى اشتراكه.",
      });
      return false;
    }
  }
  return true;
}

export function getXStoreUser(res: Response): XStoreUser {
  const user = res.locals.xstoreUser;
  if (!user) throw new Error("X-Store user middleware is missing.");
  return user;
}

export function hasRole(user: XStoreUser, roles: readonly string[]): boolean {
  if (roles.includes(user.role)) return true;
  return (
    user.role === "custom" &&
    (user.permissions ?? []).some((permission) => roles.includes(permission))
  );
}

export function denyRole(
  res: Response,
  user: XStoreUser,
  roles: readonly string[],
): boolean {
  if (hasRole(user, roles)) return false;
  res.status(403).json({ error: "You do not have permission for this action." });
  return true;
}

