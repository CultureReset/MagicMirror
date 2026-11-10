const NodeHelper = require("node_helper");
const Log = require("logger");

const DEFAULT_ENDPOINTS = {
	status: "/api/status",
	system: "/api/system",
	agents: "/api/agents",
	apps: "/api/apps",
	webapps: "/api/webapps/catalog",
	alerts: "/api/alerts",
	notifications: "/api/notifications",
	calendar: "/api/calendar",
	services: "/api/services",
	disk: "/api/files/disk",
	weather: "/api/weather",
	health: "/api/health",
	automations: "/api/automations",
	worlds: "/api/worlds",
	control: "/api/control",
	jobs: "/api/jobs",
	approvals: "/api/approvals"
};

const PRODUCT_AGENTS = [
	{ match: /openjarvis/i, label: "OpenJarvis" },
	{ match: /paperclip/i, label: "Paperclip" },
	{ match: /node \(this app\)|^node$/i, label: "NODE" },
	{ match: /\bn8n\b/i, label: "n8n" },
	{ match: /twenty/i, label: "Twenty CRM" },
	{ match: /navidrome/i, label: "Navidrome" },
	{ match: /open webui/i, label: "Open WebUI" },
	{ match: /node-chat/i, label: "node-chat" }
];

function trimSlash (url) {
	return String(url || "").replace(/\/+$/, "");
}

function joinUrl (base, path) {
	if (!path) return base;
	if (/^https?:\/\//i.test(path)) return path;
	return `${trimSlash(base)}${path.startsWith("/") ? path : `/${path}`}`;
}

function isOn (value) {
	return /^(1|true|yes|on)$/i.test(String(value ?? "").trim());
}

async function fetchJson (url, timeoutMs = 8000) {
	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort(), timeoutMs);
	try {
		const res = await fetch(url, { signal: ac.signal, headers: { Accept: "application/json" } });
		const raw = await res.text();
		let data = null;
		if (raw) {
			try {
				data = JSON.parse(raw);
			} catch {
				data = null;
			}
		}
		return { ok: res.ok, status: res.status, data };
	} finally {
		clearTimeout(timer);
	}
}

function icsEscape (value) {
	return String(value ?? "")
		.replace(/\\/g, "\\\\")
		.replace(/\r?\n/g, "\\n")
		.replace(/,/g, "\\,")
		.replace(/;/g, "\\;");
}

function icsDate (iso, allDay) {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	if (allDay) {
		const y = d.getUTCFullYear();
		const m = String(d.getUTCMonth() + 1).padStart(2, "0");
		const day = String(d.getUTCDate()).padStart(2, "0");
		return { key: "DATE", value: `${y}${m}${day}` };
	}
	const stamp = d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
	return { key: "DATE-TIME", value: stamp };
}

function pad (n) {
	return String(n).padStart(2, "0");
}

function floatingStamp (date) {
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function startOfLocalDay (date) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

function mondayOf (date) {
	const d = startOfLocalDay(date);
	const day = d.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diff);
	return d;
}

function toIcs (events, calName = "NODE") {
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//NODE//MMM-NODE//EN",
		"CALSCALE:GREGORIAN",
		`X-WR-CALNAME:${icsEscape(calName)}`
	];
	const list = Array.isArray(events) ? events : [];
	const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
	for (const ev of list) {
		if (!ev || ev.start == null) continue;
		const floating = ev.floating && ev.start instanceof Date;
		let start;
		let end;
		if (floating) {
			start = { key: "DATE-TIME", value: floatingStamp(ev.start), floating: true };
			end = ev.end instanceof Date ? { key: "DATE-TIME", value: floatingStamp(ev.end), floating: true } : null;
		} else {
			start = icsDate(ev.start, Boolean(ev.allDay));
			end = icsDate(ev.end || ev.start, Boolean(ev.allDay));
		}
		if (!start) continue;
		lines.push("BEGIN:VEVENT");
		lines.push(`UID:${icsEscape(ev.id || `${ev.start}-${ev.title || "event"}`)}@node`);
		lines.push(`DTSTAMP:${now}`);
		lines.push(`DTSTART${start.key === "DATE" ? ";VALUE=DATE" : ""}:${start.value}`);
		if (end) lines.push(`DTEND${end.key === "DATE" ? ";VALUE=DATE" : ""}:${end.value}`);
		if (ev.title) lines.push(`SUMMARY:${icsEscape(ev.title)}`);
		if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);
		if (ev.notes) lines.push(`DESCRIPTION:${icsEscape(ev.notes)}`);
		lines.push("END:VEVENT");
	}
	lines.push("END:VCALENDAR");
	return `${lines.join("\r\n")}\r\n`;
}

function buildDemoEvents () {
	const monday = mondayOf(new Date());
	const make = (id, title, week, day, hour, minute, durationMin) => {
		const start = new Date(monday);
		start.setDate(start.getDate() + week * 7 + day);
		start.setHours(hour, minute, 0, 0);
		const end = new Date(start.getTime() + durationMin * 60000);
		return { id, title, start, end, floating: true };
	};
	return {
		school: [
			make("demo-school-drop-0", "Demo: School drop-off", 0, 0, 8, 0, 30),
			make("demo-school-practice", "Demo: Team practice", 0, 1, 16, 0, 90),
			make("demo-school-drop-1", "Demo: School drop-off", 1, 0, 8, 0, 30)
		],
		family: [
			make("demo-family-movie", "Demo: Family movie night", 0, 3, 18, 0, 120),
			make("demo-family-market", "Demo: Farmers market", 0, 5, 10, 0, 90)
		],
		work: [
			make("demo-work-stand", "Demo: Team standup", 0, 2, 12, 0, 30),
			make("demo-work-dentist", "Demo: Dentist", 0, 4, 9, 0, 60)
		],
		meals: [
			make("demo-meal-tacos", "Demo: Dinner — tacos", 0, 0, 18, 30, 60),
			make("demo-meal-pasta", "Demo: Dinner — pasta", 0, 2, 18, 30, 60)
		]
	};
}

function webAppsFrom (catalog, apps) {
	if (Array.isArray(catalog)) return catalog;
	if (catalog && Array.isArray(catalog.items)) return catalog.items;
	if (catalog && Array.isArray(catalog.apps)) return catalog.apps;
	if (Array.isArray(apps)) {
		return apps.filter((app) => app && (app.source === "webapp" || app.provider === "web"));
	}
	return [];
}

function summarizeServices (payload) {
	const list = Array.isArray(payload) ? payload : payload?.services;
	if (!Array.isArray(list)) return { total: 0, running: 0, failed: 0, failedNames: [] };
	let running = 0;
	let failed = 0;
	const failedNames = [];
	for (const svc of list) {
		const state = String(svc?.state || svc?.status || "").toLowerCase();
		const isRunning = svc?.running === true || state.includes("running") || /^up\b/.test(state);
		const isFailed = svc?.ok === false || state.includes("failed") || /\bexited \([1-9]/.test(state);
		if (isRunning) running += 1;
		if (isFailed) {
			failed += 1;
			if (failedNames.length < 6 && (svc?.name || svc?.id)) failedNames.push(svc.name || svc.id);
		}
	}
	return { total: list.length, running, failed, failedNames };
}

function pickAlerts (alertsRes, notesRes) {
	if (alertsRes?.ok && alertsRes.data != null) {
		const data = alertsRes.data;
		return Array.isArray(data) ? data : data.items || data.alerts || [];
	}
	if (notesRes?.ok && notesRes.data != null) {
		const data = notesRes.data;
		return Array.isArray(data) ? data : data.items || data.notifications || [];
	}
	return [];
}

function groupAlerts (items) {
	const map = new Map();
	for (const item of items) {
		const title = item.title || item.summary || item.name || "Alert";
		const app = item.app || item.source || "";
		const key = `${app}::${title}`;
		const at = item.at || item.time || item.createdAt || item.date || null;
		const prev = map.get(key);
		if (!prev) {
			map.set(key, { id: item.id || key, app, title, at, read: Boolean(item.read), count: 1 });
		} else {
			prev.count += 1;
			if (at && (!prev.at || String(at) > String(prev.at))) prev.at = at;
		}
	}
	return [...map.values()].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

function productAgents (control) {
	const list = Array.isArray(control) ? control : control?.items || [];
	const found = [];
	for (const rule of PRODUCT_AGENTS) {
		const hit = list.find((item) => rule.match.test(String(item?.name || item?.id || "")));
		if (!hit) continue;
		const state = String(hit.status || hit.state || "").toLowerCase();
		const running = state.includes("run") || hit.running === true;
		found.push({
			id: hit.id || rule.label,
			name: rule.label,
			running,
			status: running ? "ready" : (state || "stopped")
		});
	}
	return found;
}

function worldsFrom (payload) {
	const list = Array.isArray(payload) ? payload : payload?.worlds;
	if (!Array.isArray(list)) return { active: null, items: [] };
	const active = typeof payload?.active === "string" ? payload.active : payload?.active?.id || null;
	return {
		active,
		items: list.map((world) => ({
			id: world.id,
			name: world.name || world.title || world.label || world.id
		}))
	};
}

function automationsFrom (payload) {
	const items = Array.isArray(payload) ? payload : payload?.items || payload?.running || [];
	const templates = Array.isArray(payload?.templates) ? payload.templates : [];
	const running = items.filter((item) => {
		const state = String(item?.status || item?.state || "").toLowerCase();
		return item?.running === true || state.includes("run") || state.includes("active");
	});
	return {
		running: running.map((item) => ({ id: item.id, name: item.name || item.title || item.id })),
		items: items.map((item) => ({ id: item.id, name: item.name || item.title || item.id, status: item.status || item.state || null })),
		templates: templates.map((item) => ({
			id: item.id || item.slug || item.name,
			name: item.name || item.title || item.id
		})).filter((item) => item.name)
	};
}

function healthLine (status, disk, services) {
	const parts = [];
	if (services && typeof services.total === "number") {
		if (services.failed) parts.push(`${services.failed} need attention`);
		else parts.push(`${services.running} services up`);
	}
	const total = Number(disk?.total);
	const used = Number(disk?.used);
	if (total) parts.push(`disk ${Math.round((used / total) * 100)}%`);
	const up = Number(status?.uptimeSeconds);
	if (Number.isFinite(up) && up >= 0) {
		const d = Math.floor(up / 86400);
		const h = Math.floor((up % 86400) / 3600);
		parts.push(d ? `up ${d}d ${h}h` : `up ${h}h`);
	}
	const ok = !services || !services.failed;
	return { ok, line: parts.join(" · ") || "NODE connected" };
}

module.exports = NodeHelper.create({
	started: false,
	timer: null,
	latestIcs: toIcs([]),
	demoIcs: {},
	lastPayload: null,
	config: {},

	start () {
		this.started = true;
		try {
			if (typeof this.getServerModuleConfig === "function") {
				this.config = this.getServerModuleConfig() || this.config || {};
			}
		} catch {
			this.config = this.config || {};
		}
		if (this.expressApp) {
			this.expressApp.get("/mmm-node/calendar.ics", (req, res) => {
				res.setHeader("Content-Type", "text/calendar; charset=utf-8");
				res.setHeader("Cache-Control", "no-store");
				res.send(this.latestIcs || toIcs([]));
			});
			this.expressApp.get("/mmm-node/demo/:slug.ics", (req, res) => {
				const slug = String(req.params.slug || "").toLowerCase();
				const body = this.demoIcs[slug] || toIcs([], `Demo ${slug}`);
				res.setHeader("Content-Type", "text/calendar; charset=utf-8");
				res.setHeader("Cache-Control", "no-store");
				res.send(body);
			});
			this.expressApp.get("/mmm-node/data.json", (req, res) => {
				res.setHeader("Cache-Control", "no-store");
				res.json(this.lastPayload || { ok: false, pending: true });
			});
		} else {
			Log.warn("MMM-NODE: expressApp not ready; ICS/data routes not registered");
		}
		this.refreshDemoIcs();
		this.poll();
	},

	stop () {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	},

	refreshDemoIcs () {
		const grouped = buildDemoEvents();
		this.demoIcs = {};
		for (const [slug, events] of Object.entries(grouped)) {
			const name = `Demo ${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
			this.demoIcs[slug] = toIcs(events, name);
		}
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "MMM_NODE_START") {
			this.config = { ...this.config, ...(payload || {}) };
			if (this.lastPayload) this.sendSocketNotification("MMM_NODE_DATA", this.lastPayload);
			this.refreshDemoIcs();
			this.poll();
		}
	},

	schedule () {
		if (this.timer) clearTimeout(this.timer);
		const interval = Number(this.config.updateInterval) > 2000 ? Number(this.config.updateInterval) : 15000;
		this.timer = setTimeout(() => this.poll(), interval);
	},

	async poll () {
		const nodeUrl = trimSlash(this.config.nodeUrl || process.env.NODE_URL || process.env.NODEOS_URL || "http://127.0.0.1:17770");
		const appStoreUrl = trimSlash(this.config.appStoreUrl || process.env.NODE_APP_STORE_URL || "");
		const endpoints = { ...DEFAULT_ENDPOINTS, ...(this.config.endpoints || {}) };
		const now = new Date();
		const from = new Date(now.getTime() - 7 * 864e5).toISOString();
		const to = new Date(now.getTime() + 62 * 864e5).toISOString();
		this.refreshDemoIcs();

		try {
			const calendarUrl = `${joinUrl(nodeUrl, endpoints.calendar)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
			const [
				status, system, agents, apps, webapps, alerts, notifications,
				calendar, services, disk, weather, health, automations, worlds, control, jobs, approvals,
				layout
			] = await Promise.all([
				fetchJson(joinUrl(nodeUrl, endpoints.status)),
				fetchJson(joinUrl(nodeUrl, endpoints.system)),
				fetchJson(joinUrl(nodeUrl, endpoints.agents)),
				fetchJson(joinUrl(nodeUrl, endpoints.apps)),
				fetchJson(joinUrl(nodeUrl, endpoints.webapps)),
				fetchJson(joinUrl(nodeUrl, endpoints.alerts)),
				fetchJson(joinUrl(nodeUrl, endpoints.notifications)),
				fetchJson(calendarUrl),
				fetchJson(joinUrl(nodeUrl, endpoints.services)),
				fetchJson(joinUrl(nodeUrl, endpoints.disk)),
				fetchJson(joinUrl(nodeUrl, endpoints.weather)),
				fetchJson(joinUrl(nodeUrl, endpoints.health)),
				fetchJson(joinUrl(nodeUrl, endpoints.automations)),
				fetchJson(joinUrl(nodeUrl, endpoints.worlds)),
				fetchJson(joinUrl(nodeUrl, endpoints.control)),
				fetchJson(joinUrl(nodeUrl, endpoints.jobs)),
				fetchJson(joinUrl(nodeUrl, endpoints.approvals)),
				appStoreUrl ? fetchJson(joinUrl(appStoreUrl, "/api/display/layout")) : Promise.resolve({ ok: false, data: null })
			]);

			const events = calendar.ok && Array.isArray(calendar.data)
				? calendar.data
				: (calendar.ok && Array.isArray(calendar.data?.events) ? calendar.data.events : []);
			this.latestIcs = toIcs(events);

			const servicesSummary = services.ok ? summarizeServices(services.data) : null;
			const diskData = disk.ok ? disk.data : null;
			const statusData = status.ok ? status.data : null;
			const rawAlerts = pickAlerts(alerts, notifications);
			const approvalItems = approvals.ok
				? (Array.isArray(approvals.data) ? approvals.data : approvals.data?.items || approvals.data?.approvals || [])
				: [];

			const payload = {
				ok: Boolean(status.ok || system.ok || control.ok || automations.ok || layout.ok),
				fetchedAt: now.toISOString(),
				nodeUrl,
				status: statusData,
				health: healthLine(statusData, diskData, servicesSummary),
				productAgents: control.ok ? productAgents(control.data) : [],
				personas: Array.isArray(agents.data?.personas) ? agents.data.personas.length : 0,
				apps: webAppsFrom(webapps.ok ? webapps.data : null, apps.ok ? apps.data : null).map((app) => ({
					id: app.id || app.slug,
					name: app.name || app.title || app.slug || app.id,
					category: app.category || app.kind || null
				})),
				alerts: groupAlerts(rawAlerts).slice(0, 8),
				alertCount: rawAlerts.length,
				alertsSource: alerts?.ok ? "alerts" : (notifications?.ok ? "notifications" : null),
				calendar: events.map((ev) => ({
					id: ev.id,
					title: ev.title,
					start: ev.start,
					end: ev.end,
					allDay: Boolean(ev.allDay)
				})),
				services: servicesSummary,
				automations: automations.ok ? automationsFrom(automations.data) : { running: [], items: [], templates: [] },
				worlds: worlds.ok ? worldsFrom(worlds.data) : { active: null, items: [] },
				approvals: approvalItems.map((item) => ({
					id: item.id,
					title: item.title || item.name || item.summary || "Approval",
					from: item.from || item.requester || item.app || null
				})),
				approvalsSource: approvals.ok ? "approvals" : null,
				jobs: jobs.ok && Array.isArray(jobs.data) ? jobs.data.length : 0,
				chores: [],
				meals: [],
				shopping: [],
				pantry: [],
				rewards: [],
				photos: [],
				appStoreUrl,
				displayCards: layout.ok && Array.isArray(layout.data?.items) ? layout.data.items : [],
				demoCalendar: isOn(this.config.demoCalendar) || isOn(process.env.NODE_DEMO_CALENDAR)
			};

			this.lastPayload = payload;
			this.sendSocketNotification("MMM_NODE_DATA", payload);
		} catch (error) {
			Log.error(`MMM-NODE poll failed: ${error.message}`);
			this.lastPayload = {
				ok: false,
				fetchedAt: now.toISOString(),
				nodeUrl,
				error: "unreachable"
			};
			this.sendSocketNotification("MMM_NODE_DATA", this.lastPayload);
		} finally {
			this.schedule();
		}
	}
});
