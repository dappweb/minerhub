import { extractAndVerifyAuth } from "../lib/auth";
import { createId, nowIso } from "../lib/id";
import { badRequest, json, notFound, unauthorized } from "../lib/response";
import type { Env } from "../types/env";

type AnnouncementLevel = "info" | "warning" | "critical";
type AnnouncementTarget = "all" | "active_contract";

type AnnouncementRow = {
  id: string;
  title_zh: string;
  title_en: string;
  content_zh: string;
  content_en: string;
  level: string;
  target: string;
  is_published: number;
  is_pinned: number;
  publish_at: string | null;
  expire_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type AnnouncementDto = {
  id: string;
  titleZh: string;
  titleEn: string;
  contentZh: string;
  contentEn: string;
  level: AnnouncementLevel;
  target: AnnouncementTarget;
  isPublished: boolean;
  isPinned: boolean;
  publishAt: string | null;
  expireAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

function isOwnerWallet(env: Env, wallet: string | null): boolean {
  return Boolean(env.OWNER_ADDRESS && wallet && wallet.toLowerCase() === env.OWNER_ADDRESS.toLowerCase());
}

async function requireOwnerRead(request: Request, env: Env): Promise<Response | null> {
  const wallet = request.headers.get("x-wallet");
  if (!isOwnerWallet(env, wallet)) {
    return unauthorized("Owner wallet required");
  }
  return null;
}

async function requireOwner(request: Request, env: Env): Promise<Response | null> {
  const auth = await extractAndVerifyAuth(request, env);
  if (!auth.valid) {
    return unauthorized(auth.error || "Signature verification failed");
  }

  if (!isOwnerWallet(env, auth.wallet ?? null)) {
    return unauthorized("Owner wallet required");
  }

  return null;
}

function normalizeLevel(value: unknown): AnnouncementLevel {
  return value === "warning" || value === "critical" ? value : "info";
}

function normalizeTarget(value: unknown): AnnouncementTarget {
  return value === "active_contract" ? value : "all";
}

function normalizeDateTime(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function toAnnouncementDto(row: AnnouncementRow): AnnouncementDto {
  return {
    id: row.id,
    titleZh: row.title_zh,
    titleEn: row.title_en,
    contentZh: row.content_zh,
    contentEn: row.content_en,
    level: normalizeLevel(row.level),
    target: normalizeTarget(row.target),
    isPublished: Boolean(row.is_published),
    isPinned: Boolean(row.is_pinned),
    publishAt: row.publish_at,
    expireAt: row.expire_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listPublicAnnouncements(env: Env): Promise<AnnouncementDto[]> {
  const now = nowIso();
  const { results } = await env.DB.prepare(
    `SELECT id, title_zh, title_en, content_zh, content_en, level, target,
            is_published, is_pinned, publish_at, expire_at, created_by, created_at, updated_at
     FROM announcements
     WHERE is_published = 1
       AND (publish_at IS NULL OR publish_at <= ?)
       AND (expire_at IS NULL OR expire_at > ?)
     ORDER BY is_pinned DESC, COALESCE(publish_at, created_at) DESC, updated_at DESC`
  )
    .bind(now, now)
    .all<AnnouncementRow>();

  return (results ?? []).map(toAnnouncementDto);
}

async function listAdminAnnouncements(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "all").trim();
  const now = nowIso();
  const clauses: string[] = [];
  const params: Array<string> = [];

  if (status === "published") {
    clauses.push("is_published = 1");
  } else if (status === "draft") {
    clauses.push("is_published = 0");
  } else if (status === "expired") {
    clauses.push("expire_at IS NOT NULL AND expire_at <= ?");
    params.push(now);
  } else if (status === "active") {
    clauses.push("is_published = 1");
    clauses.push("(publish_at IS NULL OR publish_at <= ?)");
    clauses.push("(expire_at IS NULL OR expire_at > ?)");
    params.push(now, now);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { results } = await env.DB.prepare(
    `SELECT id, title_zh, title_en, content_zh, content_en, level, target,
            is_published, is_pinned, publish_at, expire_at, created_by, created_at, updated_at
     FROM announcements
     ${where}
     ORDER BY is_pinned DESC, COALESCE(publish_at, created_at) DESC, updated_at DESC`
  )
    .bind(...params)
    .all<AnnouncementRow>();

  return json({ items: (results ?? []).map(toAnnouncementDto) });
}

async function createAnnouncement(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return badRequest("Invalid JSON body");

  const titleZh = typeof body.titleZh === "string" ? body.titleZh.trim() : "";
  const titleEn = typeof body.titleEn === "string" ? body.titleEn.trim() : "";
  const contentZh = typeof body.contentZh === "string" ? body.contentZh.trim() : "";
  const contentEn = typeof body.contentEn === "string" ? body.contentEn.trim() : "";
  if (!titleZh || !titleEn || !contentZh || !contentEn) {
    return badRequest("title/content in zh and en are required");
  }

  const now = nowIso();
  const id = createId("ann");
  const isPublished = Boolean(body.isPublished);
  const publishAt = normalizeDateTime(body.publishAt) ?? (isPublished ? now : null);
  const expireAt = normalizeDateTime(body.expireAt);
  if (publishAt && expireAt && publishAt >= expireAt) {
    return badRequest("expireAt must be later than publishAt");
  }

  const wallet = request.headers.get("x-wallet");
  await env.DB.prepare(
    `INSERT INTO announcements (
      id, title_zh, title_en, content_zh, content_en, level, target,
      is_published, is_pinned, publish_at, expire_at, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      titleZh,
      titleEn,
      contentZh,
      contentEn,
      normalizeLevel(body.level),
      normalizeTarget(body.target),
      isPublished ? 1 : 0,
      body.isPinned ? 1 : 0,
      publishAt,
      expireAt,
      wallet,
      now,
      now,
    )
    .run();

  const created = await env.DB.prepare(
    `SELECT id, title_zh, title_en, content_zh, content_en, level, target,
            is_published, is_pinned, publish_at, expire_at, created_by, created_at, updated_at
     FROM announcements WHERE id = ?`
  )
    .bind(id)
    .first<AnnouncementRow>();

  return json({ ok: true, item: created ? toAnnouncementDto(created) : null });
}

async function updateAnnouncement(request: Request, env: Env, announcementId: string): Promise<Response> {
  const existing = await env.DB.prepare("SELECT id, is_published, created_at, created_by FROM announcements WHERE id = ?")
    .bind(announcementId)
    .first<{ id: string; is_published: number; created_at: string; created_by: string | null }>();
  if (!existing) return json({ error: "Announcement not found" }, 404);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return badRequest("Invalid JSON body");

  const titleZh = typeof body.titleZh === "string" ? body.titleZh.trim() : null;
  const titleEn = typeof body.titleEn === "string" ? body.titleEn.trim() : null;
  const contentZh = typeof body.contentZh === "string" ? body.contentZh.trim() : null;
  const contentEn = typeof body.contentEn === "string" ? body.contentEn.trim() : null;

  const current = await env.DB.prepare(
    `SELECT id, title_zh, title_en, content_zh, content_en, level, target,
            is_published, is_pinned, publish_at, expire_at, created_by, created_at, updated_at
     FROM announcements WHERE id = ?`
  )
    .bind(announcementId)
    .first<AnnouncementRow>();
  if (!current) return json({ error: "Announcement not found" }, 404);

  const nextPublishAt = body.publishAt === null ? null : normalizeDateTime(body.publishAt) ?? current.publish_at;
  const nextExpireAt = body.expireAt === null ? null : normalizeDateTime(body.expireAt) ?? current.expire_at;
  if (nextPublishAt && nextExpireAt && nextPublishAt >= nextExpireAt) {
    return badRequest("expireAt must be later than publishAt");
  }

  await env.DB.prepare(
    `UPDATE announcements
     SET title_zh = ?,
         title_en = ?,
         content_zh = ?,
         content_en = ?,
         level = ?,
         target = ?,
         is_published = ?,
         is_pinned = ?,
         publish_at = ?,
         expire_at = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(
      titleZh ?? current.title_zh,
      titleEn ?? current.title_en,
      contentZh ?? current.content_zh,
      contentEn ?? current.content_en,
      normalizeLevel(body.level ?? current.level),
      normalizeTarget(body.target ?? current.target),
      typeof body.isPublished === "boolean" ? (body.isPublished ? 1 : 0) : current.is_published,
      typeof body.isPinned === "boolean" ? (body.isPinned ? 1 : 0) : current.is_pinned,
      nextPublishAt,
      nextExpireAt,
      nowIso(),
      announcementId,
    )
    .run();

  const updated = await env.DB.prepare(
    `SELECT id, title_zh, title_en, content_zh, content_en, level, target,
            is_published, is_pinned, publish_at, expire_at, created_by, created_at, updated_at
     FROM announcements WHERE id = ?`
  )
    .bind(announcementId)
    .first<AnnouncementRow>();

  return json({ ok: true, item: updated ? toAnnouncementDto(updated) : null });
}

async function publishAnnouncement(env: Env, announcementId: string, isPublished: boolean): Promise<Response> {
  const existing = await env.DB.prepare("SELECT id, publish_at FROM announcements WHERE id = ?")
    .bind(announcementId)
    .first<{ id: string; publish_at: string | null }>();
  if (!existing) return json({ error: "Announcement not found" }, 404);

  const publishAt = isPublished ? existing.publish_at ?? nowIso() : existing.publish_at;
  await env.DB.prepare(
    `UPDATE announcements
     SET is_published = ?, publish_at = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(isPublished ? 1 : 0, publishAt, nowIso(), announcementId)
    .run();

  return json({ ok: true, id: announcementId, isPublished, publishAt });
}

async function deleteAnnouncement(env: Env, announcementId: string): Promise<Response> {
  await env.DB.prepare("DELETE FROM announcement_reads WHERE announcement_id = ?").bind(announcementId).run();
  const result = await env.DB.prepare("DELETE FROM announcements WHERE id = ?").bind(announcementId).run();
  return json({ ok: true, deleted: Number(result.meta.changes ?? 0) > 0 });
}

async function markAnnouncementRead(request: Request, env: Env, userId: string, announcementId: string): Promise<Response> {
  const auth = await extractAndVerifyAuth(request, env);
  if (!auth.valid) {
    return unauthorized(auth.error || "Signature verification failed");
  }

  const body = (await request.json().catch(() => null)) as { wallet?: string } | null;
  const user = await env.DB.prepare("SELECT id, wallet FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: string; wallet: string }>();
  if (!user) return json({ error: "User not found" }, 404);

  const wallet = auth.wallet ?? body?.wallet ?? "";
  if (!wallet || wallet.toLowerCase() !== user.wallet.toLowerCase()) {
    return unauthorized("Wallet does not match user");
  }

  const announcement = await env.DB.prepare("SELECT id FROM announcements WHERE id = ?")
    .bind(announcementId)
    .first<{ id: string }>();
  if (!announcement) return json({ error: "Announcement not found" }, 404);

  const readAt = nowIso();
  await env.DB.prepare(
    `INSERT INTO announcement_reads (announcement_id, user_id, wallet, read_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(announcement_id, user_id)
     DO UPDATE SET wallet = excluded.wallet, read_at = excluded.read_at`
  )
    .bind(announcementId, userId, wallet.toLowerCase(), readAt)
    .run();

  return json({ ok: true, announcementId, readAt });
}

export async function handleAnnouncements(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  if (request.method === "GET" && pathParts.length === 0) {
    return json({ items: await listPublicAnnouncements(env) });
  }

  if (pathParts[0] === "admin") {
    const adminParts = pathParts.slice(1);
    const ownerCheck = request.method === "GET"
      ? await requireOwnerRead(request, env)
      : await requireOwner(request, env);
    if (ownerCheck) return ownerCheck;

    if (request.method === "GET" && adminParts.length === 0) {
      return listAdminAnnouncements(request, env);
    }

    if (request.method === "POST" && adminParts.length === 0) {
      return createAnnouncement(request, env);
    }

    if (adminParts.length === 1) {
      if (request.method === "PUT") return updateAnnouncement(request, env, adminParts[0]);
      if (request.method === "DELETE") return deleteAnnouncement(env, adminParts[0]);
    }

    if (request.method === "POST" && adminParts.length === 2 && adminParts[1] === "publish") {
      return publishAnnouncement(env, adminParts[0], true);
    }

    if (request.method === "POST" && adminParts.length === 2 && adminParts[1] === "unpublish") {
      return publishAnnouncement(env, adminParts[0], false);
    }
  }

  if (request.method === "POST" && pathParts.length === 4 && pathParts[0] === "users" && pathParts[2] === "read") {
    return markAnnouncementRead(request, env, pathParts[1], pathParts[3]);
  }

  return notFound("Unsupported announcements route");
}
