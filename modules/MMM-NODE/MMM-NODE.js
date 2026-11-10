Module.register("MMM-NODE", {
	defaults: {
		nodeUrl: null,
		updateInterval: 15000,
		kind: "hub",
		maxAgents: 6,
		maxAlerts: 4,
		maxApps: 8,
		demoCalendar: false,
		wallpaperUrl: "/modules/MMM-NODE/assets/wallpaper.jpg",
		idleMs: 120000
	},

	snapshot: null,
	idle: false,
	idleTimer: null,

	getStyles () {
		return ["MMM-NODE.css"];
	},

	start () {
		this.snapshot = null;
		this.applyWallpaper();
		this.sendSocketNotification("MMM_NODE_START", {
			nodeUrl: this.config.nodeUrl || null,
			updateInterval: this.config.updateInterval,
			endpoints: this.config.endpoints,
			demoCalendar: this.config.demoCalendar
		});
		this.pullFromServer();
		this.pullTimer = setInterval(() => this.pullFromServer(), Math.max(3000, Number(this.config.updateInterval) || 15000));
		if (this.config.kind === "photos") this.armIdleWatch();
	},

	stop () {
		if (this.pullTimer) clearInterval(this.pullTimer);
		if (this.idleTimer) clearTimeout(this.idleTimer);
	},

	applyWallpaper () {
		const url = this.config.wallpaperUrl;
		if (!url) {
			document.body.classList.add("mmm-node-no-wallpaper");
			return;
		}
		document.body.classList.remove("mmm-node-no-wallpaper");
		document.documentElement.style.setProperty("--node-wallpaper", `url("${String(url).replace(/"/g, "")}")`);
	},

	armIdleWatch () {
		const ms = Number(this.config.idleMs);
		if (!Number.isFinite(ms) || ms <= 0) return;
		const bump = () => {
			if (this.idle) {
				this.idle = false;
				this.updateDom(200);
			}
			if (this.idleTimer) clearTimeout(this.idleTimer);
			this.idleTimer = setTimeout(() => {
				this.idle = true;
				this.updateDom(400);
			}, ms);
		};
		["mousemove", "pointerdown", "keydown", "touchstart"].forEach((eventName) => {
			window.addEventListener(eventName, bump, { passive: true });
		});
		bump();
	},

	async pullFromServer () {
		try {
			const res = await fetch("/mmm-node/data.json", { cache: "no-store" });
			if (!res.ok) return;
			const payload = await res.json();
			if (payload && payload.pending) return;
			this.applyPayload(payload);
		} catch (error) {
			// Socket notifications remain the fallback.
		}
	},

	applyPayload (payload) {
		this.snapshot = payload;
		this.updateDom(300);
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "MMM_NODE_DATA") {
			this.applyPayload(payload);
		}
	},

	getDom () {
		const kind = this.config.kind || "hub";
		const root = document.createElement("div");
		root.className = `mmm-node mmm-node--${kind}`;
		if (kind === "photos") {
			root.appendChild(this.cardPhotos());
			return root;
		}
		const snapshot = this.snapshot;
		if (!snapshot) {
			root.innerHTML = "<div class=\"mmm-node__muted\">Connecting to NODE…</div>";
			return root;
		}
		if (!snapshot.ok) {
			root.innerHTML = "<div class=\"mmm-node__status mmm-node__status--down\">NODE unreachable</div>";
			return root;
		}
		if (kind === "hub") {
			root.classList.add("mmm-node--hub");
			root.appendChild(this.healthStrip(snapshot));
			if (snapshot.demoCalendar) {
				const badge = document.createElement("div");
				badge.className = "mmm-node__demo";
				badge.textContent = "Demo calendar on — labeled Demo events, not live NODE events";
				root.appendChild(badge);
			}
			const grid = document.createElement("div");
			grid.className = "mmm-node__grid";
			for (const name of [
				"agents", "workflows", "approvals", "activity",
				"chores", "meals", "lists", "pantry",
				"profiles", "photos", "rewards", "apps"
			]) {
				grid.appendChild(this.renderCard(name, snapshot, true));
			}
			root.appendChild(grid);
			return root;
		}
		root.appendChild(this.renderCard(kind, snapshot, false));
		return root;
	},

	healthStrip (snapshot) {
		const el = document.createElement("div");
		const health = snapshot.health || {};
		el.className = `mmm-node__health ${health.ok === false ? "is-warn" : "is-ok"}`;
		el.textContent = health.line || "NODE connected";
		return el;
	},

	renderCard (kind, snapshot, chrome) {
		let body;
		switch (kind) {
			case "agents": body = this.bodyAgents(snapshot); break;
			case "workflows":
			case "automations": body = this.bodyWorkflows(snapshot); break;
			case "approvals": body = this.bodyApprovals(snapshot); break;
			case "alerts":
			case "activity": body = this.bodyActivity(snapshot); break;
			case "system": body = this.bodySystem(snapshot); break;
			case "chores": body = this.bodyEmpty("No chores yet"); break;
			case "meals": body = this.bodyEmpty("No meals planned"); break;
			case "lists":
			case "shopping": body = this.bodyEmpty("List is empty"); break;
			case "pantry": body = this.bodyEmpty("No inventory yet"); break;
			case "profiles": body = this.bodyProfiles(snapshot); break;
			case "photos": body = this.bodyEmpty("Album not connected"); break;
			case "rewards": body = this.bodyEmpty("No rewards yet"); break;
			case "apps": body = this.bodyApps(snapshot); break;
			default: body = this.bodyEmpty("Coming soon");
		}
		if (!chrome) return body;
		const titles = {
			agents: "Agents",
			workflows: "Workflows",
			automations: "Workflows",
			approvals: "Approvals",
			alerts: "Activity",
			activity: "Activity",
			system: "System",
			chores: "Chores",
			meals: "Meals",
			lists: "Lists",
			shopping: "Lists",
			pantry: "Pantry",
			profiles: "Profiles",
			photos: "Photos",
			rewards: "Rewards",
			apps: "App center"
		};
		const card = this.cardShell(kind, titles[kind] || kind, this.statusFor(kind, snapshot));
		card.appendChild(body);
		return card;
	},

	statusFor (kind, snapshot) {
		if (kind === "agents") {
			const agents = snapshot.productAgents || [];
			const ready = agents.filter((a) => a.running).length;
			return agents.length ? `${ready} of ${agents.length} ready` : "";
		}
		if (kind === "workflows" || kind === "automations") {
			const auto = snapshot.automations || { running: [], templates: [] };
			return (auto.running || []).length ? `${auto.running.length} running` : "None running";
		}
		if (kind === "approvals") {
			const n = (snapshot.approvals || []).length;
			return n ? `${n} waiting` : "None waiting";
		}
		if (kind === "activity" || kind === "alerts") {
			const total = snapshot.alertCount || 0;
			return total ? `${total} grouped` : "All clear";
		}
		if (kind === "system") return snapshot.health?.ok === false ? "Needs attention" : "OK";
		if (kind === "profiles") {
			const n = (snapshot.worlds?.items || []).length;
			return n ? `${n} worlds` : "";
		}
		if (kind === "apps") return snapshot.apps?.length ? `${Math.min(snapshot.apps.length, this.config.maxApps)} ready` : "";
		return "";
	},

	bodyAgents (snapshot) {
		const wrap = document.createElement("div");
		const agents = snapshot.productAgents || [];
		const ready = agents.filter((a) => a.running).length;
		const stopped = agents.length - ready;
		const line = document.createElement("div");
		line.className = "mmm-node__status-line";
		if (!agents.length) line.textContent = "No agents reported";
		else if (stopped) line.textContent = `${ready} agents OK · ${stopped} needs you`;
		else line.textContent = `${ready} agents OK`;
		wrap.appendChild(line);
		if (agents.length) {
			const names = document.createElement("div");
			names.className = "mmm-node__muted";
			names.textContent = agents.map((a) => a.name).join(" · ");
			wrap.appendChild(names);
		}
		return wrap;
	},

	bodyWorkflows (snapshot) {
		const wrap = document.createElement("div");
		const auto = snapshot.automations || { running: [], templates: [] };
		const running = auto.running || [];
		const templates = auto.templates || [];
		const line = document.createElement("div");
		line.className = "mmm-node__status-line";
		line.textContent = running.length ? `${running.length} running` : `None running · ${templates.length} ready`;
		wrap.appendChild(line);
		if (!running.length && templates.length) {
			const next = document.createElement("div");
			next.className = "mmm-node__muted";
			next.textContent = `Next: ${templates.slice(0, 2).map((t) => t.name).join(" · ")}`;
			wrap.appendChild(next);
		}
		return wrap;
	},

	bodyApprovals (snapshot) {
		const wrap = document.createElement("div");
		const items = snapshot.approvals || [];
		const line = document.createElement("div");
		line.className = "mmm-node__status-line";
		if (!items.length) {
			line.textContent = "None waiting";
			wrap.appendChild(line);
			const hint = document.createElement("div");
			hint.className = "mmm-node__muted";
			hint.textContent = "Anything that changes the outside world waits for you";
			wrap.appendChild(hint);
			return wrap;
		}
		line.textContent = items.length === 1 ? "1 waiting" : `${items.length} waiting`;
		wrap.appendChild(line);
		const next = document.createElement("div");
		next.className = "mmm-node__next";
		next.textContent = items[0].title;
		wrap.appendChild(next);
		const actions = document.createElement("div");
		actions.className = "mmm-node__actions";
		for (const label of ["Approve", "Reject", "Request revision"]) {
			const btn = document.createElement("span");
			btn.className = "mmm-node__action";
			btn.textContent = label;
			actions.appendChild(btn);
		}
		wrap.appendChild(actions);
		return wrap;
	},

	bodyActivity (snapshot) {
		const wrap = document.createElement("div");
		wrap.className = "mmm-node__list";
		const alerts = snapshot.alerts || [];
		if (!alerts.length) {
			wrap.innerHTML = "<div class=\"mmm-node__muted\">No recent activity</div>";
			return wrap;
		}
		for (const alert of alerts.slice(0, this.config.maxAlerts)) {
			const row = document.createElement("div");
			row.className = "mmm-node__alert";
			const count = alert.count > 1 ? `${alert.count}× ` : "";
			const when = this.relTime(alert.at);
			row.innerHTML = `<div class="mmm-node__alert-title">${this.esc(count + alert.title)}</div>
				<div class="mmm-node__muted">${this.esc([alert.app, when].filter(Boolean).join(" · "))}</div>`;
			wrap.appendChild(row);
		}
		return wrap;
	},

	bodySystem (snapshot) {
		const wrap = document.createElement("div");
		wrap.className = "mmm-node__metrics";
		const services = snapshot.services || {};
		const health = snapshot.health || {};
		const diskMatch = String(health.line || "").match(/disk\s+(\d+%)/i);
		const upMatch = String(health.line || "").match(/up\s+([^·]+)/i);
		const metrics = [];
		if (typeof services.running === "number") metrics.push([String(services.running), "services"]);
		if (diskMatch) metrics.push([diskMatch[1], "disk"]);
		if (upMatch) metrics.push([upMatch[1].trim(), "up"]);
		if (typeof services.failed === "number" && services.failed) metrics.push([String(services.failed), "need attention"]);
		if (!metrics.length) {
			const line = document.createElement("div");
			line.className = "mmm-node__status-line";
			line.textContent = health.line || "NODE connected";
			wrap.appendChild(line);
			return wrap;
		}
		for (const [value, label] of metrics.slice(0, 5)) {
			const cell = document.createElement("div");
			cell.className = "mmm-node__metric";
			cell.innerHTML = `<div class="mmm-node__metric-value">${this.esc(value)}</div><div class="mmm-node__muted">${this.esc(label)}</div>`;
			wrap.appendChild(cell);
		}
		return wrap;
	},

	bodyProfiles (snapshot) {
		const worlds = snapshot.worlds || { items: [] };
		const list = document.createElement("div");
		list.className = "mmm-node__avatars";
		if (!worlds.items.length) {
			list.innerHTML = "<div class=\"mmm-node__muted\">No NODE worlds</div>";
			return list;
		}
		for (const world of worlds.items) {
			const item = document.createElement("div");
			item.className = `mmm-node__avatar ${worlds.active === world.id ? "is-active" : ""}`;
			const initial = document.createElement("span");
			initial.className = "mmm-node__glyph";
			initial.textContent = this.initials(world.name);
			const label = document.createElement("span");
			label.className = "mmm-node__avatar-name";
			label.textContent = world.name;
			item.appendChild(initial);
			item.appendChild(label);
			list.appendChild(item);
		}
		return list;
	},

	bodyApps (snapshot) {
		const apps = this.preferredApps(snapshot.apps || []);
		const list = document.createElement("div");
		list.className = "mmm-node__chips";
		if (!apps.length) {
			list.innerHTML = "<div class=\"mmm-node__muted\">No web apps in catalog</div>";
			return list;
		}
		for (const app of apps.slice(0, this.config.maxApps)) {
			const chip = document.createElement("span");
			chip.className = "mmm-node__chip";
			chip.textContent = app.name;
			list.appendChild(chip);
		}
		return list;
	},

	preferredApps (apps) {
		const rank = (app) => {
			const hay = `${app.name || ""} ${app.category || ""}`.toLowerCase();
			if (/music|navidrome|spotify|video|youtube|photo|media/.test(hay)) return 0;
			if (/mail|chat|calendar|home|photo/.test(hay)) return 1;
			return 2;
		};
		return [...apps].sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)));
	},

	bodyEmpty (message) {
		const empty = document.createElement("div");
		empty.className = "mmm-node__empty";
		empty.textContent = message;
		return empty;
	},

	cardPhotos () {
		const cover = document.createElement("div");
		cover.className = `mmm-node-idle ${this.idle ? "is-on" : ""}`;
		const label = document.createElement("div");
		label.className = "mmm-node-idle__label";
		label.textContent = "Photos";
		cover.appendChild(label);
		return cover;
	},

	cardShell (kind, title, status) {
		const wrap = document.createElement("article");
		wrap.className = `mmm-node-card mmm-node-card--${kind}`;
		wrap.dataset.card = kind;
		const head = document.createElement("header");
		head.className = "mmm-node-card__head";
		const h = document.createElement("div");
		h.className = "mmm-node-card__title";
		h.textContent = title;
		head.appendChild(h);
		if (status) {
			const s = document.createElement("div");
			s.className = "mmm-node-card__status";
			s.textContent = status;
			head.appendChild(s);
		}
		wrap.appendChild(head);
		return wrap;
	},

	initials (name) {
		const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
		if (!parts.length) return "?";
		if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
		return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
	},

	relTime (iso) {
		if (!iso) return "";
		const t = new Date(iso).getTime();
		if (Number.isNaN(t)) return "";
		const delta = Date.now() - t;
		const mins = Math.round(delta / 60000);
		if (mins < 1) return "just now";
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.round(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.round(hours / 24);
		return `${days}d ago`;
	},

	esc (value) {
		return String(value ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}
});
