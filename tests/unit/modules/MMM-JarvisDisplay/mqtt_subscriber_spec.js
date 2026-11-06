import { describe, expect, it, vi } from "vitest";
import {
	createReadOnlySubscriber,
	resolveBrokerConfig
} from "../../../../modules/MMM-JarvisDisplay/lib/mqttSubscriber";

describe("MMM-JarvisDisplay mqttSubscriber", () => {
	it("requires an mqtt URL from config or env placeholder", () => {
		const missing = resolveBrokerConfig({}, {});
		expect(missing.error).toBe("missing_mqtt_url");

		const fromEnv = resolveBrokerConfig({}, { MMM_JARVIS_DISPLAY_MQTT_URL: "mqtt://127.0.0.1:1883" });
		expect(fromEnv.error).toBeNull();
		expect(fromEnv.url).toBe("mqtt://127.0.0.1:1883");
		expect(fromEnv.password).toBeNull();
	});

	it("rejects unsupported protocols", () => {
		const result = resolveBrokerConfig({ mqttUrl: "http://example.com" }, {});
		expect(result.error).toBe("unsupported_mqtt_protocol");
	});

	it("subscribes read-only and never exposes publish", () => {
		const handlers = {};
		const client = {
			on: vi.fn((event, cb) => {
				handlers[event] = cb;
			}),
			subscribe: vi.fn((topic, opts, cb) => cb && cb(null)),
			end: vi.fn(),
			publish: vi.fn()
		};
		const onMessage = vi.fn();
		const onStatus = vi.fn();

		const subscriber = createReadOnlySubscriber({
			config: { mqttUrl: "mqtt://127.0.0.1:1883" },
			topics: ["gcr/display/v1/tasks"],
			onMessage,
			onStatus,
			createClient: () => client
		});

		expect(subscriber).not.toHaveProperty("publish");
		subscriber.start();
		handlers.connect();
		expect(client.subscribe).toHaveBeenCalledWith(
			"gcr/display/v1/tasks",
			{ qos: 0 },
			expect.any(Function)
		);
		handlers.message("gcr/display/v1/tasks", Buffer.from("{\"items\":[]}"));
		expect(onMessage).toHaveBeenCalled();
		subscriber.stop();
		expect(client.end).toHaveBeenCalled();
		expect(client.publish).not.toHaveBeenCalled();
	});

	it("reports misconfigured status when URL is absent", () => {
		const onStatus = vi.fn();
		const subscriber = createReadOnlySubscriber({
			config: {},
			topics: ["gcr/display/v1/tasks"],
			onMessage: () => {},
			onStatus,
			createClient: () => ({ on () {}, subscribe () {}, end () {} }),
			env: {}
		});
		subscriber.start();
		expect(onStatus).toHaveBeenCalledWith("misconfigured", { error: "missing_mqtt_url" });
	});
});
