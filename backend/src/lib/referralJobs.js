import { createId, nowIso } from "./id";
export async function createReferralBindJob(env, params) {
    const inviteeWallet = params.inviteeWallet.trim().toLowerCase();
    const inviterWallet = params.inviterWallet.trim().toLowerCase();
    const now = params.now ?? nowIso();
    const existing = await env.DB.prepare(`SELECT id, invitee_wallet, inviter_wallet, tx_hash, status, last_error, retry_count, created_at, updated_at
     FROM referral_bind_jobs
     WHERE invitee_wallet = ? AND inviter_wallet = ?`)
        .bind(inviteeWallet, inviterWallet)
        .first();
    if (existing) {
        await env.DB.prepare(`UPDATE referral_bind_jobs
       SET tx_hash = COALESCE(?, tx_hash),
           status = 'pending',
           last_error = ?,
           retry_count = retry_count + 1,
           updated_at = ?
       WHERE invitee_wallet = ? AND inviter_wallet = ?`)
            .bind(params.txHash ?? null, params.error ?? null, now, inviteeWallet, inviterWallet)
            .run();
        return {
            ...existing,
            tx_hash: params.txHash ?? existing.tx_hash,
            status: "pending",
            last_error: params.error ?? null,
            retry_count: Number(existing.retry_count ?? 0) + 1,
            updated_at: now,
        };
    }
    const job = {
        id: createId("rbj"),
        invitee_wallet: inviteeWallet,
        inviter_wallet: inviterWallet,
        tx_hash: params.txHash ?? null,
        status: "pending",
        last_error: params.error ?? null,
        retry_count: 0,
        created_at: now,
        updated_at: now,
    };
    await env.DB.prepare(`INSERT INTO referral_bind_jobs (
      id, invitee_wallet, inviter_wallet, tx_hash, status, last_error, retry_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(job.id, job.invitee_wallet, job.inviter_wallet, job.tx_hash, job.status, job.last_error, job.retry_count, job.created_at, job.updated_at)
        .run();
    return job;
}
export async function markReferralBindJobBound(env, inviteeWalletRaw, inviterWalletRaw, at = nowIso()) {
    const inviteeWallet = inviteeWalletRaw.trim().toLowerCase();
    const inviterWallet = inviterWalletRaw.trim().toLowerCase();
    await env.DB.prepare(`UPDATE referral_bind_jobs
     SET status = 'bound', last_error = NULL, updated_at = ?
     WHERE invitee_wallet = ? AND inviter_wallet = ?`)
        .bind(at, inviteeWallet, inviterWallet)
        .run();
}
