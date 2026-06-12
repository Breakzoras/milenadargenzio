/* ============================================================
   Milena D'Argenzio - publish function
   Server-side μόνο. Τα μυστικά (PIN, PUK, GitHub token) ζουν ΩΣ
   Netlify environment variables και ΔΕΝ εκτίθενται ποτέ στον client.
   Ενεργεί: verify (έλεγχος PIN/PUK) + publish (commit στο data.json).
   ============================================================ */

const REPO = process.env.GITHUB_REPO || "Breakzoras/milenadargenzio";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const FILE = "data.json";

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(obj),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

  const PIN = process.env.EDIT_PIN;
  const PUK = process.env.EDIT_PUK;
  const TOKEN = process.env.GITHUB_TOKEN;
  if (!PIN || !PUK || !TOKEN) return json(501, { error: "not_configured" });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "bad_json" });
  }

  /* ---- VERIFY ---- */
  if (body.action === "verify") {
    const value = String(body.value || "");
    const ok = body.mode === "puk" ? value === PUK : value === PIN;
    return ok ? json(200, { ok: true }) : json(401, { ok: false });
  }

  /* ---- PUBLISH ---- */
  if (body.action === "publish") {
    const auth = String(body.auth || "");
    if (auth !== PIN && auth !== PUK) return json(401, { error: "unauthorized" });

    const code = String(body.code || "");
    const field = String(body.field || "");
    let value = body.value;
    if (typeof value !== "string") return json(400, { error: "bad_value" });
    value = value.slice(0, 5000);

    // Allowlist πεδίων
    const isTitle = field === "title";
    const isBlurb = field === "blurb";
    const isDetail = field.startsWith("details.") && field.length > 8;
    if (!isTitle && !isBlurb && !isDetail) return json(400, { error: "bad_field" });

    const apiBase = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
    const headers = {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "milena-publish-fn",
    };

    try {
      // 1. Διάβασε το τρέχον data.json
      const getRes = await fetch(`${apiBase}?ref=${BRANCH}`, { headers });
      if (!getRes.ok) return json(502, { error: "github_read_failed", status: getRes.status });
      const getData = await getRes.json();
      const sha = getData.sha;
      const current = Buffer.from(getData.content, "base64").toString("utf-8");
      const data = JSON.parse(current);

      // 2. Βρες το νυφικό και ενημέρωσε το πεδίο
      const dress = (data.dresses || []).find((d) => String(d.code) === code);
      if (!dress) return json(404, { error: "code_not_found" });

      if (isTitle) dress.title = value;
      else if (isBlurb) dress.blurb = value;
      else {
        const key = field.slice("details.".length);
        if (!dress.details || !(key in dress.details)) return json(400, { error: "bad_detail_key" });
        dress.details[key] = value;
      }

      // 3. Commit το ενημερωμένο data.json
      const updated = JSON.stringify(data, null, 2);
      const putRes = await fetch(apiBase, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Edit ${code} ${field} (via editor)`,
          content: Buffer.from(updated, "utf-8").toString("base64"),
          sha,
          branch: BRANCH,
        }),
      });
      if (!putRes.ok) {
        const errTxt = await putRes.text().catch(() => "");
        return json(502, { error: "github_write_failed", status: putRes.status, detail: errTxt.slice(0, 200) });
      }
      return json(200, { ok: true });
    } catch (e) {
      return json(500, { error: "server_error", detail: String(e).slice(0, 200) });
    }
  }

  return json(400, { error: "unknown_action" });
};
