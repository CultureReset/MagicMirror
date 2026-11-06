"use strict";

/**
 * Read-only MQTT subscriber wrapper for the proposed display bridge.
 * Intentionally exposes subscribe/close only — no publish API.
 */

/**
 * Resolve broker URL from module config and environment placeholders.
 * Never invents credentials; empty username/password means anonymous.
 * @param {object} config
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{url: string|null, username: string|null, password: string|null, error: string|null}}
 */
function resolveBrokerConfig (config = {}, env = process.env) {
	const url =
		(typeof config.mqttUrl === "string" && config.mqttUrl.trim()) ||
		(typeof env.MMM_JARVIS_DISPLAY_MQTT_URL === "string" && env.MMM_JARVIS_DISPLAY_MQTT_URL.trim()) ||
		null;

	const username =
		(typeof config.mqttUsername === "string" && config.mqttUsername.trim()) ||
		(typeof env.MMM_JARVIS_DISPLAY_MQTT_USERNAME === "string" && env.MMM_JARVIS_DISPLAY_MQTT_USERNAME.trim()) ||
		null;

	const password =
		(typeof config.mqttPassword === "string" && config.mqttPassword) ||
		(typeof env.MMM_JARVIS_DISPLAY_MQTT_PASSWORD === "string" && env.MMM_JARVIS_DISPLAY_MQTT_PASSWORD) ||
		null;

	if (!url) {
		return {
			url: null,
			username: null,
			password: null,
			error: "missing_mqtt_url"
		};
	}

	// Guard against accidental embedding of credentials in the URL being logged elsewhere.
	try {
		const parsed = new URL(url);
		if (!["mqtt:", "mqtts:", "ws:", "wss:", "tcp:"].includes(parsed.protocol)) {
			return { url: null, username: null, password: null, error: "unsupported_mqtt_protocol" };
		}
	} catch {
		return { url: null, username: null, password: null, error: "invalid_mqtt_url" };
	}

	return { url, username, password, error: null };
}

/**
 * @param {object} options
 * @param {object} options.config
 * @param {string[]} options.topics
 * @param {(topic: string, payload: Buffer) => void} options.onMessage
 * @param {(event: string, detail?: object) => void} [options.onStatus]
 * @param {(opts: object) => {on: Function, subscribe: Function, end: Function}} [options.createClient]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @returns {{start: Function, stop: Function, getStatus: Function}}
 */
function createReadOnlySubscriber (options) {
	const {
		config,
		topics,
		onMessage,
		onStatus = () => {},
		createClient,
		env = process.env
	} = options;

	let client = null;
	let status = "idle";
	let lastError = null;

	const broker = resolveBrokerConfig(config, env);

	const start = () => {
		if (client) {
			return;
		}
		if (broker.error || !broker.url) {
			status = "misconfigured";
			lastError = broker.error || "missing_mqtt_url";
			onStatus("misconfigured", { error: lastError });
			return;
		}

		if (typeof createClient !== "function") {
			status = "unavailable";
			lastError = "mqtt_client_factory_missing";
			onStatus("unavailable", { error: lastError });
			return;
		}

		const connectOptions = {
			reconnectPeriod: Number.isFinite(config.reconnectPeriodMs) ? config.reconnectPeriodMs : 5000,
			connectTimeout: Number.isFinite(config.connectTimeoutMs) ? config.connectTimeoutMs : 10000,
			clientId: typeof config.clientId === "string" && config.clientId.trim()
				? config.clientId.trim()
				: `mmm-jarvis-display-${Math.random().toString(16).slice(2, 10)}`
		};
		if (broker.username) {
			connectOptions.username = broker.username;
		}
		if (broker.password) {
			connectOptions.password = broker.password;
		}

		status = "connecting";
		onStatus("connecting", { urlHost: safeHost(broker.url) });

		client = createClient({ url: broker.url, options: connectOptions });

		client.on("connect", () => {
			status = "connected";
			lastError = null;
			onStatus("connected", { urlHost: safeHost(broker.url) });
			for (const topic of topics) {
				client.subscribe(topic, { qos: 0 }, (err) => {
					if (err) {
						lastError = "subscribe_failed";
						onStatus("subscribe_error", { topic, error: String(err.message || err) });
					} else {
						onStatus("subscribed", { topic });
					}
				});
			}
		});

		client.on("reconnect", () => {
			status = "reconnecting";
			onStatus("reconnecting", { urlHost: safeHost(broker.url) });
		});

		client.on("close", () => {
			if (status !== "stopped") {
				status = "disconnected";
				onStatus("disconnected", {});
			}
		});

		client.on("error", (err) => {
			lastError = "client_error";
			onStatus("error", { error: String(err && err.message ? err.message : err) });
		});

		client.on("message", (topic, payload) => {
			onMessage(topic, payload);
		});
	};

	const stop = () => {
		status = "stopped";
		if (!client) {
			return;
		}
		const current = client;
		client = null;
		try {
			current.end(true);
		} catch {
			// ignore shutdown races
		}
		onStatus("stopped", {});
	};

	const getStatus = () => ({ status, lastError, urlHost: broker.url ? safeHost(broker.url) : null });

	return { start, stop, getStatus, brokerError: broker.error };
}

/**
 * @param {string} url
 * @returns {string}
 */
function safeHost (url) {
	try {
		const parsed = new URL(url);
		return `${parsed.protocol}//${parsed.host}`;
	} catch {
		return "invalid-url";
	}
}

module.exports = {
	resolveBrokerConfig,
	createReadOnlySubscriber,
	safeHost
};
