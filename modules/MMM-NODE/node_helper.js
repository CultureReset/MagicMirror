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
	health: "/api/health"
};

function trimSlash (url) {
	return String(url || "").replace(/\/+$/, "");
}

function joinUrl (base, path) {
	if (!path) return base;
	if (/^https?:\/\//i.test(path)) return path;
	return `${trimSlash(base)}${path.startsWith("/") ? path : `/${path}`}`;
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

function toIcs (events) {
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//NODE//MMM-NODE//EN",
		"CALSCALE:GREGORIAN",
		"X-WR-CALNAME:NODE"
	];
	const list = Array.isArray(events) ? events : [];
	const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
	for (const ev of list) {
		if (!ev || !ev.start) continue;
		const start = icsDate(ev.start, Boolean(ev.allDay));
		const end = icsDate(ev.end || ev.start, Boolean(ev.allDay));
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

module.exports = NodeHelper.create({
	started: false,
	timer: null,
	latestIcs: toIcs([]),
	lastPayload: null,
	config: {},

	start () {
		this.started = true;
		const config = this.getServerModuleConfig();
		this.config = config || {};
		if (this.expressApp) {
			this.expressApp.get("/mmm-node/calendar.ics", (req, res) => {
				res.setHeader("Content-Type", "text/calendar; charset=utf-8");
				res.setHeader("Cache-Control", "no-store");
				res.send(this.latestIcs || toIcs([]));
			});
			this.expressApp.get("/mmm-node/data.json", (req, res) => {
				res.setHeader("Cache-Control", "no-store");
				res.json(this.lastPayload || { ok: false, pending: true });
			});
		} else {
			Log.warn("MMM-NODE: expressApp not ready; ICS/data routes not registered");
		}
		this.poll();
	},

	stop () {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "MMM_NODE_START") {
			this.config = { ...this.config, ...(payload || {}) };
			if (this.lastPayload) this.sendSocketNotification("MMM_NODE_DATA", this.lastPayload);
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
		const endpoints = { ...DEFAULT_ENDPOINTS, ...(this.config.endpoints || {}) };
		const now = new Date();
		const from = new Date(now.getTime() - 7 * 864e5).toISOString();
		const to = new Date(now.getTime() + 62 * 864e5).toISOString();

		try {
			const calendarUrl = `${joinUrl(nodeUrl, endpoints.calendar)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
			const [status, system, agents, apps, webapps, alerts, notifications, calendar, services, disk, weather, health] = await Promise.all([
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
				fetchJson(joinUrl(nodeUrl, endpoints.health))
			]);

			const events = calendar.ok && Array.isArray(calendar.data) ? calendar.data : (calendar.ok && Array.isArray(calendar.data?.events) ? calendar.data.events : []);
			this.latestIcs = toIcs(events);

			const payload = {
				ok: Boolean(status.ok || system.ok),
				fetchedAt: now.toISOString(),
				nodeUrl,
				status: status.ok ? status.data : null,
				system: system.ok ? system.data : null,
				agents: agents.ok ? agents.data : null,
				apps: webAppsFrom(webapps.ok ? webapps.data : null, apps.ok ? apps.data : null).map((app) => ({
					id: app.id || app.slug,
					name: app.name || app.title || app.slug || app.id,
					category: app.category || null
				})),
				alerts: pickAlerts(alerts, notifications).slice(0, 12).map((item) => ({
					id: item.id,
					app: item.app || item.source || "",
					title: item.title || item.summary || item.name || "Alert",
					at: item.at || item.time || item.createdAt || item.date || null,
					read: Boolean(item.read)
				})),
				calendar: events.map((ev) => ({
					id: ev.id,
					title: ev.title,
					start: ev.start,
					end: ev.end,
					allDay: Boolean(ev.allDay)
				})),
				services: services.ok ? summarizeServices(services.data) : null,
				disk: disk.ok ? disk.data : null,
				weather: weather.ok ? { location: weather.data?.location, tempC: weather.data?.tempC, tempF: weather.data?.tempF, summary: weather.data?.summary } : null,
				health: health.ok ? health.data : null,
				alertsSource: alerts?.ok ? "alerts" : (notifications?.ok ? "notifications" : null)
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
