// ============================================================
// admin-list.js — GIBS Personal Mastery: Lead from Within
// Fetches all campaign applications as JSON (or CSV) from Netlify Blobs.
// ============================================================
// Campaign-scoped only. Not a CRM, not connected to any student
// management system, holds no data beyond this campaign's applications.
//
// Protected by a shared secret passed as a URL parameter, set via the
// Netlify environment variable ADMIN_KEY. One password for the whole
// team — deliberately simple, matching the Trailblazer Open Day pattern.
//
// To use:
//   https://your-site.netlify.app/.netlify/functions/admin-list?key=YOUR_SECRET
//
// Optionally:
//   ?key=YOUR_SECRET&format=csv   (download the raw list as CSV)
//
// Duplicate flagging (by email) and incomplete flagging are computed
// client-side in admin.html, since they depend on comparing every
// record against every other — this function's job is just to return
// the full, current record set as fast and simply as possible.
// ============================================================

import { getStore } from "@netlify/blobs";

export default async (request, context) => {
  const url = new URL(request.url);
  const key    = url.searchParams.get("key") || "";
  const format = url.searchParams.get("format") || "json";

  // The expected key lives in a Netlify environment variable. If ADMIN_KEY
  // is unset, refuse to serve anything — safer than defaulting to a
  // known-bad value.
  const expected = process.env.ADMIN_KEY || "";
  if (!expected || key !== expected) {
    return new Response(
      JSON.stringify({ ok: false, error: "Forbidden" }),
      { status: 403, headers: { "content-type": "application/json" } }
    );
  }

  try {
    const store = getStore({ name: "pm-applications" });

    // List every key in the store. At this campaign's scale (up to a
    // few hundred applications) this is fast and needs no pagination.
    const { blobs } = await store.list();

    // Read each record. Promise.all runs them in parallel.
    const records = await Promise.all(
      blobs.map((b) => store.get(b.key, { type: "json" }))
    );

    // Drop nulls (should not occur, but a record could fail to parse).
    const entries = records.filter((r) => r !== null);

    // Sort newest first.
    entries.sort((a, b) =>
      (b.submittedAt || "").localeCompare(a.submittedAt || "")
    );

    if (format === "csv") {
      const header = [
        "applicationId", "submittedAt", "firstName", "surname", "email",
        "phone", "commitDates", "commitHours", "commitDevice",
        "marketingOptIn", "source", "campaign", "status"
      ];
      const csvLines = [header.join(",")];
      for (const r of entries) {
        const row = header
          .map((k) => {
            const v = r[k];
            const s = v == null ? "" : String(v);
            // Wrap fields that contain a comma, quote, or newline.
            return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",");
        csvLines.push(row);
      }
      return new Response(csvLines.join("\n"), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="pm-lfw-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // Default: JSON response.
    return new Response(
      JSON.stringify({
        ok: true,
        store: "pm-applications",
        count: entries.length,
        entries,
      }, null, 2),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (err) {
    console.error("Admin list failed:", err.message, err.stack);
    return new Response(
      JSON.stringify({ ok: false, error: "Storage unavailable" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
