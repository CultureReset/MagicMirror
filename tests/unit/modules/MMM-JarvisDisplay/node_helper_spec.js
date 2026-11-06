import Module from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const loadHelper = async ({ createClient } = {}) => {
	vi.resetModules();
	const loggerMock = { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() };
	const originalRequire = Module.prototype.require;

	Module.prototype.require = function (id) {
		if (id === "node_helper") {
			return { create: vi.fn((definition) => definition) };
		}
		if (id === "logger") {
			return loggerMock;
		}
		if (id === "mqtt") {
			throw new Error("mqtt should be injected in tests");
		}
		return originalRequire.apply(this, arguments);
	};

	let helper;
	try {
		const helperModule = await import("../../../../modules/MMM-JarvisDisplay/node_helper");
		helper = helperModule.default || helperModule;
	} finally {
		Module.prototype.require = originalRequire;
	}

	helper.sendSocketNotification = vi.fn();
	helper.name = "MMM-JarvisDisplay";
	helper.subscriber = null;
	helper.config = null;

	if (createClient) {
		helper._testCreateClient = createClient;
	}

	return { helper, loggerMock };
};

afterEach(() => {
	vi.resetAllMocks();
	vi.resetModules();
});

describe("MMM-JarvisDisplay node_helper", () => {
	it("forwards sanitized tasks payloads over socket notifications", async () => {
		const handlers = {};
		const client = {
			on: vi.fn((event, cb) => {
				handlers[event] = cb;
			}),
			subscribe: vi.fn((topic, opts, cb) => cb && cb(null)),
			end: vi.fn()
		};

		const { helper } = await loadHelper();
		helper.socketNotificationReceived("MMM_JARVIS_DISPLAY_CONNECT", {
			mqttUrl: "mqtt://127.0.0.1:1883",
			topics: { tasks: "gcr/display/v1/tasks", bridge: "gcr/display/v1/bridge" },
			maxItems: 5,
			__testCreateClient: () => client
		});

		handlers.connect();
		handlers.message(
			"gcr/display/v1/tasks",
			Buffer.from(
				JSON.stringify({
					schema: "gcr.display.tasks.v1",
					items: [{ task_id: "1", title: "Demo", status: "todo" }]
				})
			)
		);

		expect(helper.sendSocketNotification).toHaveBeenCalledWith(
			"MMM_JARVIS_DISPLAY_TASKS",
			expect.objectContaining({
				items: [expect.objectContaining({ task_id: "1", title: "Demo", status: "todo" })]
			})
		);
	});

	it("does not forward forbidden payloads", async () => {
		const handlers = {};
		const client = {
			on: vi.fn((event, cb) => {
				handlers[event] = cb;
			}),
			subscribe: vi.fn((topic, opts, cb) => cb && cb(null)),
			end: vi.fn()
		};
		const { helper } = await loadHelper();
		helper.socketNotificationReceived("MMM_JARVIS_DISPLAY_CONNECT", {
			mqttUrl: "mqtt://127.0.0.1:1883",
			topics: { tasks: "gcr/display/v1/tasks", bridge: "gcr/display/v1/bridge" },
			__testCreateClient: () => client
		});
		handlers.connect();
		handlers.message(
			"gcr/display/v1/tasks",
			Buffer.from(JSON.stringify({ items: [{ task_id: "1", title: "X" }], token: "secret" }))
		);
		expect(helper.sendSocketNotification).toHaveBeenCalledWith(
			"MMM_JARVIS_DISPLAY_ERROR",
			expect.objectContaining({ error: "forbidden_fields" })
		);
		expect(helper.sendSocketNotification).not.toHaveBeenCalledWith(
			"MMM_JARVIS_DISPLAY_TASKS",
			expect.anything()
		);
	});
});
