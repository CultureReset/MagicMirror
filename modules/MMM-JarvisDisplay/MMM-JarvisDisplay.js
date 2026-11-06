/* global Module, Log */

Module.register("MMM-JarvisDisplay", {
	defaults: {
		header: "Jarvis Tasks",
		// Broker is unresolved in shared context — use placeholders only.
		// Prefer env MMM_JARVIS_DISPLAY_MQTT_URL on the MagicMirror host.
		mqttUrl: "",
		mqttUsername: "",
		mqttPassword: "",
		// PROPOSED topics (not an existing bridge contract).
		topics: {
			tasks: "gcr/display/v1/tasks",
			bridge: "gcr/display/v1/bridge"
		},
		maxItems: 8,
		showBridgeState: true,
		updateDomSpeed: 300,
		reconnectPeriodMs: 5000,
		connectTimeoutMs: 10000
	},

	requiresVersion: "2.28.0",

	start () {
		Log.info(`Starting module: ${this.name}`);
		this.tasks = [];
		this.tasksUpdatedAt = null;
		this.bridge = null;
		this.connection = { status: "starting" };
		this.lastError = null;
		this.sendSocketNotification("MMM_JARVIS_DISPLAY_CONNECT", this._helperConfig());
	},

	suspend () {
		this.sendSocketNotification("MMM_JARVIS_DISPLAY_DISCONNECT");
	},

	resume () {
		this.sendSocketNotification("MMM_JARVIS_DISPLAY_CONNECT", this._helperConfig());
	},

	getStyles () {
		return ["MMM-JarvisDisplay.css"];
	},

	getHeader () {
		return this.config.header;
	},

	getDom () {
		const wrapper = document.createElement("div");
		wrapper.className = "mmm-jarvis-display";

		if (this.config.showBridgeState) {
			const status = document.createElement("div");
			status.className = "mmm-jarvis-display__status dimmed small";
			const bridgeState = this.bridge?.state ? `bridge:${this.bridge.state}` : null;
			const parts = [
				`mqtt:${this.connection.status || "unknown"}`,
				bridgeState,
				this.lastError ? `err:${this.lastError}` : null
			].filter(Boolean);
			status.textContent = parts.join(" · ");
			wrapper.appendChild(status);
		}

		if (!this.tasks.length) {
			const empty = document.createElement("div");
			empty.className = "dimmed small";
			empty.textContent = "Waiting for proposed display payloads…";
			wrapper.appendChild(empty);
			return wrapper;
		}

		const list = document.createElement("ul");
		list.className = "mmm-jarvis-display__list";
		for (const item of this.tasks) {
			const li = document.createElement("li");
			li.className = `mmm-jarvis-display__item status-${item.status}`;

			const title = document.createElement("div");
			title.className = "mmm-jarvis-display__title bright";
			title.textContent = item.title;
			li.appendChild(title);

			const meta = document.createElement("div");
			meta.className = "mmm-jarvis-display__meta small dimmed";
			meta.textContent = [item.status, item.summary].filter(Boolean).join(" — ");
			li.appendChild(meta);

			list.appendChild(li);
		}
		wrapper.appendChild(list);

		if (this.tasksUpdatedAt) {
			const updated = document.createElement("div");
			updated.className = "mmm-jarvis-display__updated xsmall dimmed";
			updated.textContent = `Updated ${this.tasksUpdatedAt}`;
			wrapper.appendChild(updated);
		}

		return wrapper;
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "MMM_JARVIS_DISPLAY_TASKS") {
			this.tasks = Array.isArray(payload?.items) ? payload.items : [];
			this.tasksUpdatedAt = payload?.updated_at || null;
			this.lastError = null;
			this.updateDom(this.config.updateDomSpeed);
			return;
		}
		if (notification === "MMM_JARVIS_DISPLAY_BRIDGE") {
			this.bridge = payload || null;
			this.updateDom(this.config.updateDomSpeed);
			return;
		}
		if (notification === "MMM_JARVIS_DISPLAY_STATUS") {
			this.connection = payload || {};
			if (payload?.error) {
				this.lastError = payload.error;
			}
			this.updateDom(this.config.updateDomSpeed);
			return;
		}
		if (notification === "MMM_JARVIS_DISPLAY_ERROR") {
			this.lastError = payload?.error || "payload_error";
			this.updateDom(this.config.updateDomSpeed);
		}
	},

	_helperConfig () {
		// Never send unexpected control fields; passwords only via configured placeholders/env on server.
		return {
			mqttUrl: this.config.mqttUrl,
			mqttUsername: this.config.mqttUsername,
			mqttPassword: this.config.mqttPassword,
			topics: this.config.topics,
			maxItems: this.config.maxItems,
			reconnectPeriodMs: this.config.reconnectPeriodMs,
			connectTimeoutMs: this.config.connectTimeoutMs
		};
	}
});
