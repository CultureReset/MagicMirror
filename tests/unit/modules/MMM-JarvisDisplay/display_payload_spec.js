import { describe, expect, it } from "vitest";
import {
	PROPOSED_SCHEMA_TASKS,
	parseBridgePayload,
	parseTasksPayload
} from "../../../../modules/MMM-JarvisDisplay/lib/displayPayload";

describe("MMM-JarvisDisplay displayPayload", () => {
	it("parses a valid proposed tasks snapshot", () => {
		const result = parseTasksPayload({
			schema: PROPOSED_SCHEMA_TASKS,
			updated_at: "2026-11-06T12:00:00.000Z",
			items: [
				{
					task_id: "task-1",
					title: "Summarize local doc",
					status: "in_progress",
					summary: "Hermes read-only demo",
					updated_at: "2026-11-06T11:59:00.000Z"
				}
			]
		});

		expect(result.ok).toBe(true);
		expect(result.payload.items).toHaveLength(1);
		expect(result.payload.items[0]).toMatchObject({
			task_id: "task-1",
			title: "Summarize local doc",
			status: "in_progress"
		});
	});

	it("accepts JSON strings and coerces unknown statuses", () => {
		const result = parseTasksPayload(
			JSON.stringify({
				items: [{ task_id: "x", title: "Y", status: "flying" }]
			})
		);
		expect(result.ok).toBe(true);
		expect(result.payload.items[0].status).toBe("unknown");
	});

	it("rejects payloads with forbidden approval/secret fields", () => {
		const result = parseTasksPayload({
			items: [{ task_id: "x", title: "Y" }],
			approval: { allow: true }
		});
		expect(result.ok).toBe(false);
		expect(result.error).toBe("forbidden_fields");
	});

	it("rejects nested credential-like keys inside items", () => {
		const result = parseTasksPayload({
			items: [{ task_id: "x", title: "Y", api_key: "nope" }]
		});
		expect(result.ok).toBe(false);
		expect(result.error).toBe("forbidden_fields");
	});

	it("rejects unsupported schema ids", () => {
		const result = parseTasksPayload({
			schema: "gcr.display.tasks.v0",
			items: [{ task_id: "x", title: "Y" }]
		});
		expect(result.ok).toBe(false);
		expect(result.error).toBe("unsupported_schema");
	});

	it("caps items at maxItems", () => {
		const items = Array.from({ length: 20 }, (_, i) => ({
			task_id: `t${i}`,
			title: `Title ${i}`,
			status: "todo"
		}));
		const result = parseTasksPayload({ items }, { maxItems: 3 });
		expect(result.ok).toBe(true);
		expect(result.payload.items).toHaveLength(3);
	});

	it("parses proposed bridge health payloads", () => {
		const result = parseBridgePayload({
			schema: "gcr.display.bridge.v1",
			state: "degraded",
			message: "broker lag",
			updated_at: "2026-11-06T12:00:00.000Z"
		});
		expect(result.ok).toBe(true);
		expect(result.payload.state).toBe("degraded");
	});

	it("rejects bridge payloads carrying command fields", () => {
		const result = parseBridgePayload({ state: "ok", command: "restart" });
		expect(result.ok).toBe(false);
		expect(result.error).toBe("forbidden_fields");
	});
});
