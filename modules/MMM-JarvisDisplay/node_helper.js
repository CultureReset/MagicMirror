"use strict";

const NodeHelper = require("node_helper");
const Log = require("logger");
const { parseTasksPayload, parseBridgePayload } = require("./lib/displayPayload");
const { createReadOnlySubscriber } = require("./lib/mqttSubscriber");

/**
 * Server-side helper: read-only MQTT → sanitized socket notifications.
 * No publish, no business DB, no approval/command fields.
 */
module.exports = NodeHelper.create({
	start () {
		Log.log(`Starting node helper for: ${this.name}`);
		this.subscriber = null;
		this.config = null;
	},

	stop () {
		this._stopSubscriber();
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "MMM_JARVIS_DISPLAY_CONNECT") {
			this._connect(payload || {});
		} else if (notification === "MMM_JARVIS_DISPLAY_DISCONNECT") {
			this._stopSubscriber();
			this.sendSocketNotification("MMM_JARVIS_DISPLAY_STATUS", { status: "stopped" });
		}
	},

	_stopSubscriber () {
		if (this.subscriber) {
			this.subscriber.stop();
			this.subscriber = null;
		}
	},

	_connect (config) {
		this._stopSubscriber();
		this.config = config;

		const topics = [];
		const tasksTopic = (config.topics && config.topics.tasks) || "gcr/display/v1/tasks";
		const bridgeTopic = (config.topics && config.topics.bridge) || "gcr/display/v1/bridge";
		if (tasksTopic) {
			topics.push(tasksTopic);
		}
		if (bridgeTopic) {
			topics.push(bridgeTopic);
		}

		let createClient = config.__testCreateClient;
		if (typeof createClient !== "function") {
			try {
				const mqtt = require("mqtt");
				createClient = ({ url, options }) => mqtt.connect(url, options);
			} catch (error) {
				Log.error(`${this.name}: mqtt package missing — ${error.message}`);
				this.sendSocketNotification("MMM_JARVIS_DISPLAY_STATUS", {
					status: "unavailable",
					error: "mqtt_dependency_missing"
				});
				return;
			}
		}

		this.subscriber = createReadOnlySubscriber({
			config,
			topics,
			createClient,
			onStatus: (event, detail = {}) => {
				this.sendSocketNotification("MMM_JARVIS_DISPLAY_STATUS", { status: event, ...detail });
			},
			onMessage: (topic, buffer) => {
				this._handleMessage(topic, buffer, tasksTopic, bridgeTopic, config);
			}
		});

		this.subscriber.start();
	},

	_handleMessage (topic, buffer, tasksTopic, bridgeTopic, config) {
		const text = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer || "");

		if (topic === tasksTopic) {
			const parsed = parseTasksPayload(text, { maxItems: config.maxItems });
			if (!parsed.ok) {
				Log.warn(`${this.name}: rejected tasks payload (${parsed.error}) on ${topic}`);
				this.sendSocketNotification("MMM_JARVIS_DISPLAY_ERROR", {
					kind: "tasks",
					error: parsed.error,
					topic
				});
				return;
			}
			this.sendSocketNotification("MMM_JARVIS_DISPLAY_TASKS", parsed.payload);
			return;
		}

		if (topic === bridgeTopic) {
			const parsed = parseBridgePayload(text);
			if (!parsed.ok) {
				Log.warn(`${this.name}: rejected bridge payload (${parsed.error}) on ${topic}`);
				this.sendSocketNotification("MMM_JARVIS_DISPLAY_ERROR", {
					kind: "bridge",
					error: parsed.error,
					topic
				});
				return;
			}
			this.sendSocketNotification("MMM_JARVIS_DISPLAY_BRIDGE", parsed.payload);
		}
	}
});
