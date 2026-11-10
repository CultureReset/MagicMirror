Module.register("MMM-NODE", {
	defaults: {
		nodeUrl: null,
		updateInterval: 15000,
		maxAgents: 8,
		maxAlerts: 6,
		maxApps: 21
	},

	snapshot: null,

	getStyles () {
		return ["MMM-NODE.css"];
	},

	start () {
		this.snapshot = null;
		const nodeUrl = this.config.nodeUrl || null;
		this.sendSocketNotification("MMM_NODE_START", {
			nodeUrl,
			updateInterval: this.config.updateInterval,
			endpoints: this.config.endpoints
		});
		this.pullFromServer();
		this.pullTimer = setInterval(() => this.pullFromServer(), Math.max(3000, Number(this.config.updateInterval) || 15000));
	},

	stop () {
		if (this.pullTimer) clearInterval(this.pullTimer);
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
		this.updateDom(400);
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "MMM_NODE_DATA") {
			this.applyPayload(payload);
		}
	},

	getDom () {
		const root = document.createElement("div");
		root.className = "mmm-node";
		const snapshot = this.snapshot;
		if (!snapshot) {
			root.innerHTML = "<div class=\"mmm-node__muted\">Connecting to NODE…</div>";
			return root;
		}
		if (!snapshot.ok) {
			root.innerHTML = "<div class=\"mmm-node__status mmm-node__status--down\">NODE unreachable</div>";
			return root;
		}

		root.appendChild(this.sectionVitals(snapshot));
		root.appendChild(this.sectionAgents(snapshot));
		root.appendChild(this.sectionAlerts(snapshot));
		root.appendChild(this.sectionApps(snapshot));
		return root;
	},

	sectionVitals (snapshot) {
		const wrap = this.block("System");
		const status = snapshot.status || {};
		const system = snapshot.system || {};
		const disk = snapshot.disk || {};
		const services = snapshot.services || {};
		const rows = [
			["CPU", system.cpu || "—"],
			["Memory", this.memoryLabel(system, disk)],
			["Disk", this.diskLabel(disk)],
			["Up", this.uptimeLabel(status.uptimeSeconds)],
			["Net", this.networkLabel(status.network)],
			["Services", this.servicesLabel(services)],
			["GPU / power", "Not in daemon API"]
		];
		const table = document.createElement("div");
		table.className = "mmm-node__rows";
		for (const [label, value] of rows) {
			const row = document.createElement("div");
			row.className = "mmm-node__row";
			row.innerHTML = `<span class="mmm-node__k">${this.esc(label)}</span><span class="mmm-node__v">${this.esc(value)}</span>`;
			table.appendChild(row);
		}
		wrap.appendChild(table);
		return wrap;
	},

	sectionAgents (snapshot) {
		const wrap = this.block("Agents");
		const providers = snapshot.agents?.providers || [];
		const list = document.createElement("div");
		list.className = "mmm-node__list";
		const shown = providers.slice(0, this.config.maxAgents);
		if (!shown.length) {
			list.innerHTML = "<div class=\"mmm-node__muted\">No agents reported</div>";
		} else {
			for (const agent of shown) {
				const row = document.createElement("div");
				row.className = "mmm-node__row";
				const state = agent.installed ? (agent.isDefault ? "installed · default" : "installed") : "not installed";
				row.innerHTML = `<span class="mmm-node__k">${this.esc(agent.name || agent.id)}</span><span class="mmm-node__v ${agent.installed ? "is-on" : "is-off"}">${this.esc(state)}</span>`;
				list.appendChild(row);
			}
		}
		const personas = snapshot.agents?.personas;
		if (Array.isArray(personas) && personas.length) {
			const meta = document.createElement("div");
			meta.className = "mmm-node__muted";
			meta.textContent = `${personas.length} personas`;
			list.appendChild(meta);
		}
		wrap.appendChild(list);
		return wrap;
	},

	sectionAlerts (snapshot) {
		const wrap = this.block("Alerts");
		const alerts = snapshot.alerts || [];
		const list = document.createElement("div");
		list.className = "mmm-node__list";
		if (!alerts.length) {
			list.innerHTML = "<div class=\"mmm-node__muted\">No alerts</div>";
		} else {
			for (const alert of alerts.slice(0, this.config.maxAlerts)) {
				const row = document.createElement("div");
				row.className = "mmm-node__alert";
				const when = this.relTime(alert.at);
				row.innerHTML = `<div class="mmm-node__alert-title">${this.esc(alert.title)}</div><div class="mmm-node__muted">${this.esc([alert.app, when].filter(Boolean).join(" · "))}</div>`;
				list.appendChild(row);
			}
		}
		wrap.appendChild(list);
		return wrap;
	},

	sectionApps (snapshot) {
		const wrap = this.block("Apps");
		const apps = snapshot.apps || [];
		const list = document.createElement("div");
		list.className = "mmm-node__chips";
		if (!apps.length) {
			list.innerHTML = "<div class=\"mmm-node__muted\">No web apps in catalog</div>";
		} else {
			for (const app of apps.slice(0, this.config.maxApps)) {
				const chip = document.createElement("span");
				chip.className = "mmm-node__chip";
				chip.textContent = app.name;
				list.appendChild(chip);
			}
		}
		wrap.appendChild(list);
		return wrap;
	},

	block (title) {
		const wrap = document.createElement("section");
		wrap.className = "mmm-node__block";
		const h = document.createElement("div");
		h.className = "mmm-node__h";
		h.textContent = title;
		wrap.appendChild(h);
		return wrap;
	},

	memoryLabel (system) {
		return system.memory ? String(system.memory) : "—";
	},

	diskLabel (disk) {
		const total = Number(disk.total);
		const used = Number(disk.used);
		if (!total) return "—";
		const pct = Math.round((used / total) * 100);
		return `${pct}% · ${this.bytes(used)} / ${this.bytes(total)}`;
	},

	servicesLabel (services) {
		if (!services || typeof services.total !== "number") return "—";
		const failed = services.failed ? ` · ${services.failed} failed` : "";
		return `${services.running} running / ${services.total}${failed}`;
	},

	networkLabel (network) {
		if (!network) return "—";
		const parts = [network.type, network.online === false ? "offline" : "online"].filter(Boolean);
		return parts.join(" · ") || "—";
	},

	uptimeLabel (seconds) {
		const n = Number(seconds);
		if (!Number.isFinite(n) || n < 0) return "—";
		const d = Math.floor(n / 86400);
		const h = Math.floor((n % 86400) / 3600);
		const m = Math.floor((n % 3600) / 60);
		if (d) return `${d}d ${h}h`;
		if (h) return `${h}h ${m}m`;
		return `${m}m`;
	},

	bytes (n) {
		const gb = Number(n) / (1024 ** 3);
		if (gb >= 100) return `${Math.round(gb)} GB`;
		if (gb >= 10) return `${gb.toFixed(0)} GB`;
		if (gb >= 1) return `${gb.toFixed(1)} GB`;
		const mb = Number(n) / (1024 ** 2);
		return `${Math.round(mb)} MB`;
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
