// Standby Atlas : serveur MCP (Streamable HTTP, sans état) sur l'index gratuit.
// Cloudflare Pages, mode avancé : seul /mcp arrive ici (voir _routes.json) ; tout le reste est servi tel quel.
// Ne lit que /api/v1/projects.json, donc uniquement des champs gratuits. Aucun secret dans ce fichier.

const SITE = "https://standbyatlas.com/";
const SERVEUR = { name: "standby-atlas", title: "Standby Atlas", version: "1.0.0", websiteUrl: SITE };
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
  "X-Content-Type-Options": "nosniff",
};
const TAILLE_MAX = 65536; // octets par requête
const court = (v) => String(v).slice(0, 80); // ce qu'on renvoie d'une saisie reste court
const CONSIGNES =
  "Standby Atlas lists upcoming European data-centre projects read from public filings: environmental opinions, emission permits " +
  "for backup generators, planning decisions and grid concessions. Each record gives the stage, filing date, MW, number of backup " +
  "generators, their thermal input, the engine makes named and a link to the official document. Figures are as stated in the filing; " +
  "an empty field means the filing does not state it. A make named in a permit is not a purchase order. Always cite the official " +
  "source_url and 'Standby Atlas'. These are the free fields; licences add engine models, exhaust treatment, fuel storage, permitted " +
  "hours and the dated history of each filing: " + SITE + "pricing/";

const LECTURE = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const OUTILS = [
  {
    name: "search_projects", title: "Search data-centre projects",
    description: "Search upcoming European data-centre projects found in public filings. Filter by country, engine make named in the filing, stage, filing date, number of backup generators or free text. Returns the free fields and the official source of each project.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: {
        country: { type: "string", description: "Country name in English, e.g. Germany, France, Ireland, United Kingdom" },
        engine_make: { type: "string", description: "Engine maker named in the filing: Caterpillar, MTU, Cummins, Kohler (Rehlko), Mitsubishi, Volvo Penta, Perkins or Baudouin" },
        stage: { type: "string", description: "Words of the stage, e.g. 'granted', 'application', 'environmental-authority opinion', 'BImSchG'" },
        text: { type: "string", description: "Words matched against operator, town, stage and authority, e.g. 'Equinix Frankfurt'" },
        filed_after: { type: "string", description: "Only filings dated on or after this day, YYYY-MM-DD" },
        filed_before: { type: "string", description: "Only filings dated on or before this day, YYYY-MM-DD" },
        min_generators: { type: "integer", minimum: 0, description: "Only projects whose filing states at least this many backup generators" },
        sort: { type: "string", enum: ["newest", "generators", "thermal_mw"], description: "Order of results (default newest)" },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Maximum number of projects returned (default 20)" },
      },
    },
    annotations: LECTURE,
  },
  {
    name: "latest_filings", title: "Latest filings",
    description: "The most recent data-centre filings in the index, newest first, for one country or for all of Europe.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: {
        country: { type: "string", description: "Country name in English; leave empty for all of Europe" },
        since: { type: "string", description: "Only filings dated on or after this day, YYYY-MM-DD" },
        limit: { type: "integer", minimum: 1, maximum: 50, description: "Number of filings (default 10)" },
      },
    },
    annotations: LECTURE,
  },
  {
    name: "pipeline_stats", title: "Pipeline totals",
    description: "Totals of the data-centre pipeline grouped by country, engine make or stage: number of projects, backup generator sets stated and their thermal input. Optional filters narrow the totals.",
    inputSchema: {
      type: "object", additionalProperties: false, required: ["group_by"],
      properties: {
        group_by: { type: "string", enum: ["country", "engine_make", "stage"], description: "How to group the totals" },
        country: { type: "string", description: "Only this country" },
        engine_make: { type: "string", description: "Only projects naming this engine make" },
        stage: { type: "string", description: "Only stages containing these words" },
      },
    },
    annotations: LECTURE,
  },
  {
    name: "search", title: "Search (free text)",
    description: "Free-text search across all projects (operator, town, country, stage, engine make, authority). Returns ids, titles and links; use fetch for a full record.",
    inputSchema: { type: "object", additionalProperties: false, required: ["query"], properties: { query: { type: "string", description: "Search words" } } },
    annotations: LECTURE,
  },
  {
    name: "fetch", title: "Get one project",
    description: "Full free record of one project by its Standby Atlas id (for example DE-HE-HOFHEIM-DCH-MARXHEIM), with the official source.",
    inputSchema: { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", description: "Standby Atlas record id" } } },
    annotations: LECTURE,
  },
];

// ------------------------------------------------------------------ index gratuit
let INDEX = null, CHARGE = 0;
async function index(env, request) {
  if (INDEX && Date.now() - CHARGE < 3600e3) return INDEX;
  const r = await env.ASSETS.fetch(new Request(new URL("/api/v1/projects.json", request.url)));
  if (!r.ok) throw new Error("index unavailable (" + r.status + ")");
  const d = await r.json();
  d.projects.forEach((p) => { p._t = norm([p.id, p.country, p.municipality, p.operator, p.stage, p.engine_makes, p.source_authority].join(" ")); });
  INDEX = d; CHARGE = Date.now();
  return d;
}

function norm(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ß/g, "ss");
}
const ALIAS_PAYS = {
  de: "germany", deutschland: "germany", allemagne: "germany", fr: "france", frankreich: "france", ie: "ireland", irlande: "ireland", irland: "ireland",
  uk: "united kingdom", gb: "united kingdom", "great britain": "united kingdom", britain: "united kingdom", england: "united kingdom", "royaume-uni": "united kingdom",
  it: "italy", italie: "italy", italien: "italy", es: "spain", espagne: "spain", spanien: "spain", nl: "netherlands", holland: "netherlands", "pays-bas": "netherlands",
  niederlande: "netherlands", be: "belgium", belgique: "belgium", belgien: "belgium", no: "norway", norvege: "norway", norwegen: "norway", se: "sweden", suede: "sweden",
  schweden: "sweden", fi: "finland", finlande: "finland", finnland: "finland", dk: "denmark", danemark: "denmark", ch: "switzerland",
  suisse: "switzerland", schweiz: "switzerland", at: "austria", autriche: "austria", osterreich: "austria", oesterreich: "austria", pl: "poland", pologne: "poland",
  polen: "poland", pt: "portugal", is: "iceland", islande: "iceland",
};
function pays(p, voulu) {
  if (!voulu) return true;
  let v = norm(voulu).trim();
  v = ALIAS_PAYS[v] || v;
  const c = norm(p.country);
  return c === v || c.includes(v);
}
const ALIAS_MARQUE = { cat: "caterpillar", "rolls-royce": "mtu", "rolls royce": "mtu", rehlko: "kohler", "volvo": "volvo penta" };
function marque(p, voulue) {
  if (!voulue) return true;
  let v = norm(voulue).trim();
  v = ALIAS_MARQUE[v] || v;
  return norm(p.engine_makes).split("; ").some((m) => m && (m.includes(v) || v.includes(m.split(" ")[0])));
}
function mots(p, texte, champ) {
  if (!texte) return true;
  const cible = champ ? norm(p[champ]) : p._t;
  return norm(texte).split(/[\s,]+/).filter(Boolean).slice(0, 12).every((m) => cible.includes(m));
}
function jour(s, nom) {
  if (s === undefined || s === null || s === "") return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) throw new Erreur(nom + " must be a date written YYYY-MM-DD");
  return s;
}
function entier(v, defaut, min, max, nom) {
  if (v === undefined || v === null || v === "") return defaut;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Erreur(nom + " must be a number");
  return Math.max(min, Math.min(max, Math.floor(n)));
}
class Erreur extends Error {}

function titre(p) {
  const lieu = [p.municipality, p.country].filter(Boolean).join(", ");
  return (p.operator ? p.operator + " data centre in " : "Data-centre project in ") + lieu;
}
function sortie(p) {
  return {
    id: p.id, title: titre(p), country: p.country, municipality: p.municipality, operator: p.operator || null, stage: p.stage,
    filing_date: p.filing_date || null, it_mw: p.it_mw ?? null, grid_mw: p.grid_mw ?? null, backup_generators: p.backup_generators ?? null,
    thermal_mw: p.thermal_mw ?? null, engine_makes: p.engine_makes ? p.engine_makes.split("; ") : [],
    source_authority: p.source_authority, source_url: p.source_url, page: SITE + "projects/" + p.id.toLowerCase() + "/",
  };
}
const TRIS = {
  newest: (a, b) => String(b.filing_date || "").localeCompare(String(a.filing_date || "")),
  generators: (a, b) => (b.backup_generators || 0) - (a.backup_generators || 0),
  thermal_mw: (a, b) => (b.thermal_mw || 0) - (a.thermal_mw || 0),
};
function resultat(objet) {
  return { content: [{ type: "text", text: JSON.stringify(objet) }], structuredContent: objet };
}
function enTete(d) {
  return { data_as_of: d.meta.data_as_of, licence: d.meta.licence, more_fields: SITE + "pricing/" };
}

async function appel(nom, a, env, request) {
  const d = await index(env, request);
  a = a || {};
  if (nom === "search_projects") {
    const apres = jour(a.filed_after, "filed_after"), avant = jour(a.filed_before, "filed_before");
    const min = entier(a.min_generators, 0, 0, 100000, "min_generators"), lim = entier(a.limit, 20, 1, 50, "limit");
    const tri = TRIS[a.sort || "newest"];
    if (!tri) throw new Erreur("sort must be newest, generators or thermal_mw");
    const l = d.projects.filter((p) => pays(p, a.country) && marque(p, a.engine_make) && mots(p, a.stage, "stage") && mots(p, a.text)
      && (!apres || (p.filing_date || "") >= apres) && (!avant || (p.filing_date && p.filing_date <= avant))
      && (!min || (p.backup_generators || 0) >= min)).sort(tri);
    return resultat({ ...enTete(d), matches: l.length, shown: Math.min(lim, l.length), projects: l.slice(0, lim).map(sortie) });
  }
  if (nom === "latest_filings") {
    const depuis = jour(a.since, "since"), lim = entier(a.limit, 10, 1, 50, "limit");
    const l = d.projects.filter((p) => p.filing_date && pays(p, a.country) && (!depuis || p.filing_date >= depuis)).sort(TRIS.newest);
    return resultat({ ...enTete(d), matches: l.length, shown: Math.min(lim, l.length), projects: l.slice(0, lim).map(sortie) });
  }
  if (nom === "pipeline_stats") {
    const g = a.group_by;
    if (!["country", "engine_make", "stage"].includes(g)) throw new Erreur("group_by must be country, engine_make or stage");
    const l = d.projects.filter((p) => pays(p, a.country) && marque(p, a.engine_make) && mots(p, a.stage, "stage"));
    const groupes = new Map();
    for (const p of l) {
      const cles = g === "country" ? [p.country] : g === "stage" ? [p.stage] : (p.engine_makes ? p.engine_makes.split("; ") : ["No make named"]);
      for (const k of cles) {
        const s = groupes.get(k) || { group: k, projects: 0, generator_sets_stated: 0, projects_with_generator_count: 0, thermal_mw_stated: 0 };
        s.projects++;
        if (p.backup_generators) { s.generator_sets_stated += p.backup_generators; s.projects_with_generator_count++; }
        if (p.thermal_mw) s.thermal_mw_stated = Math.round((s.thermal_mw_stated + p.thermal_mw) * 10) / 10;
        groupes.set(k, s);
      }
    }
    const lignes = [...groupes.values()].sort((x, y) => y.projects - x.projects || y.generator_sets_stated - x.generator_sets_stated);
    return resultat({
      ...enTete(d), grouped_by: g, projects_counted: l.length, groups: lignes,
      note: (g === "engine_make" ? "A project naming several makes counts once under each. " : "") + "Totals are lower bounds: they add only what filings state.",
    });
  }
  if (nom === "search") {
    const q = String(a.query || "").trim();
    if (!q) throw new Erreur("query is empty");
    const l = d.projects.filter((p) => mots(p, q)).sort(TRIS.newest).slice(0, 20);
    return resultat({ results: l.map((p) => ({ id: p.id, title: titre(p) + " (" + p.stage + (p.filing_date ? ", " + p.filing_date : "") + ")", url: SITE + "projects/" + p.id.toLowerCase() + "/" })) });
  }
  if (nom === "fetch") {
    const id = String(a.id || "").trim().toUpperCase();
    const p = d.projects.find((x) => x.id.toUpperCase() === id);
    if (!p) throw new Erreur("No project with id " + court(id) + ". Use search or search_projects to find ids.");
    const s = sortie(p);
    const texte = [
      s.title + ".", "Stage: " + s.stage + (s.filing_date ? ", filing dated " + s.filing_date : "") + ".",
      s.backup_generators ? "Backup generators: " + s.backup_generators + "." : "Backup generators: not stated in the filing.",
      s.thermal_mw ? "Generator thermal input: " + s.thermal_mw + " MW." : "",
      s.it_mw ? "IT load: " + s.it_mw + " MW." : "", s.grid_mw ? "Grid connection: " + s.grid_mw + " MW." : "",
      s.engine_makes.length ? "Engine makes named: " + s.engine_makes.join(", ") + "." : "No engine make named in the filing.",
      "Source: " + s.source_authority + ", " + s.source_url + ".", "Data as of " + d.meta.data_as_of + ". Cite Standby Atlas.",
    ].filter(Boolean).join(" ");
    return resultat({ id: p.id, title: s.title, text: texte, url: s.page, metadata: s });
  }
  return null;
}

// ------------------------------------------------------------------ JSON-RPC
async function traiter(m, env, request) {
  const estRequete = m && typeof m === "object" && typeof m.method === "string" && m.id !== undefined && m.id !== null;
  if (!estRequete) return null; // notification ou réponse du client : rien à renvoyer
  const ok = (result) => ({ jsonrpc: "2.0", id: m.id, result });
  const ko = (code, message) => ({ jsonrpc: "2.0", id: m.id, error: { code, message } });
  const p = m.params || {};
  switch (m.method) {
    case "initialize": {
      const demande = p.protocolVersion;
      return ok({
        protocolVersion: VERSIONS.includes(demande) ? demande : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVEUR,
        instructions: CONSIGNES,
      });
    }
    case "ping": return ok({});
    case "tools/list": return ok({ tools: OUTILS });
    case "resources/list": return ok({ resources: [] });
    case "resources/templates/list": return ok({ resourceTemplates: [] });
    case "prompts/list": return ok({ prompts: [] });
    case "logging/setLevel": return ok({});
    case "tools/call": {
      if (!OUTILS.some((o) => o.name === p.name)) return ko(-32602, "Unknown tool: " + court(p.name));
      try {
        return ok(await appel(p.name, p.arguments, env, request));
      } catch (x) {
        if (x instanceof Erreur) return ok({ content: [{ type: "text", text: x.message }], isError: true });
        return ok({ content: [{ type: "text", text: "The index could not be read just now. Try again in a minute." }], isError: true });
      }
    }
    default: return ko(-32601, "Method not found: " + court(m.method));
  }
}

function json(objet, statut = 200, plus = {}) {
  return new Response(JSON.stringify(objet), { status: statut, headers: { "Content-Type": "application/json", ...CORS, ...plus } });
}

async function mcp(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method === "GET") {
    if ((request.headers.get("Accept") || "").includes("text/event-stream")) {
      return new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS", ...CORS } });
    }
    return Response.redirect(new URL("/api/#mcp", request.url).toString(), 302);
  }
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS", ...CORS } });
  if (Number(request.headers.get("Content-Length") || 0) > TAILLE_MAX) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large" } }, 413);
  if (tropDeRequetes(request)) return json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Too many requests: about one per second, please" } }, 429, { "Retry-After": "30" });
  let corps;
  try {
    const texte = await lireBorne(request);
    if (texte === null) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large" } }, 413);
    corps = JSON.parse(texte);
  } catch (_) {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  const lot = Array.isArray(corps) ? corps : [corps];
  if (!lot.length || lot.length > 20) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid request" } }, 400);
  const version = request.headers.get("MCP-Protocol-Version");
  const init = lot.some((m) => m && m.method === "initialize");
  if (version && !init && !VERSIONS.includes(version)) {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Unsupported MCP-Protocol-Version: " + version } }, 400);
  }
  const reponses = (await Promise.all(lot.map((m) => traiter(m, env, request)))).filter(Boolean);
  if (!reponses.length) return new Response(null, { status: 202, headers: CORS });
  return json(Array.isArray(corps) ? reponses : reponses[0]);
}

// corps de requête lu par morceaux et coupé au-delà de TAILLE_MAX (même sans en-tête Content-Length)
async function lireBorne(request) {
  if (!request.body) return "";
  const lecteur = request.body.getReader(), morceaux = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > TAILLE_MAX) { try { await lecteur.cancel(); } catch (_) { /* rien */ } return null; }
    morceaux.push(value);
  }
  const tout = new Uint8Array(total);
  let pos = 0;
  for (const m of morceaux) { tout.set(m, pos); pos += m.byteLength; }
  return new TextDecoder().decode(tout);
}

// limite simple par adresse, en mémoire de l'instance : 90 requêtes par minute (les conditions d'utilisation en annoncent une par seconde)
const COMPTES = new Map();
function tropDeRequetes(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "?";
  const maintenant = Date.now();
  let c = COMPTES.get(ip);
  if (!c || maintenant - c.debut > 60e3) { c = { debut: maintenant, n: 0 }; COMPTES.set(ip, c); }
  c.n++;
  if (COMPTES.size > 5000) { for (const [k, v] of COMPTES) if (maintenant - v.debut > 60e3) COMPTES.delete(k); }
  return c.n > 90;
}

export default {
  async fetch(request, env) {
    const chemin = new URL(request.url).pathname;
    if (chemin === "/mcp" || chemin === "/mcp/") return mcp(request, env);
    return env.ASSETS.fetch(request);
  },
};
