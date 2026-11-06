"use strict";

/**
 * Proposed MagicMirror display payload helpers (v1).
 *
 * IMPORTANT: Topics and schemas here are PROPOSED only. Hub Planner verified
 * that no finalized MQTT bridge/topic/schema exists yet. Do not treat these
 * strings as live production contracts.
 */

const PROPOSED_SCHEMA_TASKS = "gcr.display.tasks.v1";
const PROPOSED_SCHEMA_BRIDGE = "gcr.display.bridge.v1";

const ALLOWED_STATUSES = Object.freeze([
	"backlog",
	"todo",
	"in_progress",
	"in_review",
	"blocked",
	"done",
	"cancelled",
	"unknown"
]);

/**
 * Field name patterns that must never appear on the display surface.
 * Approvals/commands/secrets are out of scope for MagicMirror (read-only).
 */
const FORBIDDEN_KEY_PATTERN =
	/^(approval|approvals|command|commands|password|passwd|token|secret|secrets|credential|credentials|authorization|auth|allow|db|database|connectionstring|connection_string|api[_-]?key|private[_-]?key)$/i;

const FORBIDDEN_NESTED_HINT =
	/(password|passwd|token|secret|credential|api[_-]?key|private[_-]?key|authorization)/i;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject (value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function isForbiddenKey (key) {
	return FORBIDDEN_KEY_PATTERN.test(String(key));
}

/**
 * Recursively detect forbidden keys without retaining their values.
 * @param {unknown} value
 * @param {number} depth
 * @returns {boolean}
 */
function containsForbiddenKeys (value, depth = 0) {
	if (depth > 6 || value === null || typeof value !== "object") {
		return false;
	}
	if (Array.isArray(value)) {
		return value.some((entry) => containsForbiddenKeys(entry, depth + 1));
	}
	for (const [key, child] of Object.entries(value)) {
		if (isForbiddenKey(key) || FORBIDDEN_NESTED_HINT.test(key)) {
			return true;
		}
		if (containsForbiddenKeys(child, depth + 1)) {
			return true;
		}
	}
	return false;
}

/**
 * @param {unknown} value
 * @param {number} maxLen
 * @returns {string|null}
 */
function asTrimmedString (value, maxLen) {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}
	return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
function asIsoTimestamp (value) {
	const text = asTrimmedString(value, 64);
	if (!text) {
		return null;
	}
	const ms = Date.parse(text);
	if (Number.isNaN(ms)) {
		return null;
	}
	return new Date(ms).toISOString();
}

/**
 * @param {unknown} status
 * @returns {string}
 */
function normalizeStatus (status) {
	const text = asTrimmedString(status, 32);
	if (!text) {
		return "unknown";
	}
	const normalized = text.toLowerCase().replace(/\s+/g, "_");
	return ALLOWED_STATUSES.includes(normalized) ? normalized : "unknown";
}

/**
 * Parse and sanitize a proposed tasks snapshot payload.
 * Rejects envelopes that carry approvals/commands/secrets.
 * @param {unknown} raw
 * @param {{maxItems?: number}} [options]
 * @returns {{ok: true, payload: object}|{ok: false, error: string}}
 */
function parseTasksPayload (raw, options = {}) {
	const maxItems = Number.isFinite(options.maxItems) ? Math.max(1, Math.min(50, options.maxItems)) : 8;

	let data = raw;
	if (typeof raw === "string") {
		try {
			data = JSON.parse(raw);
		} catch {
			return { ok: false, error: "invalid_json" };
		}
	}

	if (!isPlainObject(data)) {
		return { ok: false, error: "not_an_object" };
	}

	if (containsForbiddenKeys(data)) {
		return { ok: false, error: "forbidden_fields" };
	}

	const schema = asTrimmedString(data.schema, 64);
	if (schema && schema !== PROPOSED_SCHEMA_TASKS) {
		return { ok: false, error: "unsupported_schema" };
	}

	const sourceItems = Array.isArray(data.items) ? data.items : Array.isArray(data.tasks) ? data.tasks : null;
	if (!sourceItems) {
		return { ok: false, error: "missing_items" };
	}

	const items = [];
	for (const entry of sourceItems) {
		if (!isPlainObject(entry) || containsForbiddenKeys(entry)) {
			continue;
		}
		const taskId = asTrimmedString(entry.task_id ?? entry.id, 128);
		const title = asTrimmedString(entry.title ?? entry.name, 160);
		if (!taskId || !title) {
			continue;
		}
		items.push({
			task_id: taskId,
			title,
			status: normalizeStatus(entry.status),
			summary: asTrimmedString(entry.summary ?? entry.description, 240),
			updated_at: asIsoTimestamp(entry.updated_at ?? entry.updatedAt)
		});
		if (items.length >= maxItems) {
			break;
		}
	}

	return {
		ok: true,
		payload: {
			schema: PROPOSED_SCHEMA_TASKS,
			updated_at: asIsoTimestamp(data.updated_at ?? data.updatedAt) || new Date().toISOString(),
			source: asTrimmedString(data.source, 64),
			items
		}
	};
}

/**
 * Parse optional bridge/health display payload (proposed).
 * @param {unknown} raw
 * @returns {{ok: true, payload: object}|{ok: false, error: string}}
 */
function parseBridgePayload (raw) {
	let data = raw;
	if (typeof raw === "string") {
		try {
			data = JSON.parse(raw);
		} catch {
			return { ok: false, error: "invalid_json" };
		}
	}
	if (!isPlainObject(data)) {
		return { ok: false, error: "not_an_object" };
	}
	if (containsForbiddenKeys(data)) {
		return { ok: false, error: "forbidden_fields" };
	}
	const schema = asTrimmedString(data.schema, 64);
	if (schema && schema !== PROPOSED_SCHEMA_BRIDGE) {
		return { ok: false, error: "unsupported_schema" };
	}
	const state = asTrimmedString(data.state ?? data.status, 32)?.toLowerCase() || "unknown";
	const allowedStates = new Set(["ok", "degraded", "offline", "unknown"]);
	return {
		ok: true,
		payload: {
			schema: PROPOSED_SCHEMA_BRIDGE,
			state: allowedStates.has(state) ? state : "unknown",
			message: asTrimmedString(data.message, 160),
			updated_at: asIsoTimestamp(data.updated_at ?? data.updatedAt) || new Date().toISOString()
		}
	};
}

module.exports = {
	PROPOSED_SCHEMA_TASKS,
	PROPOSED_SCHEMA_BRIDGE,
	ALLOWED_STATUSES,
	FORBIDDEN_KEY_PATTERN,
	parseTasksPayload,
	parseBridgePayload,
	containsForbiddenKeys
};
