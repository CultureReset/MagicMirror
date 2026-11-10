const Log = require("logger");
const WeatherProvider = require("../weatherprovider");

// WMO / Open-Meteo style codes, matching the built-in openmeteo provider names
// so the stock weather icons render. NODE /api/weather already uses this `code`.
const WEATHER_TYPES = {
	0: "day-sunny",
	1: "day-cloudy",
	2: "day-cloudy",
	3: "day-sunny-overcast",
	45: "day-fog",
	48: "day-fog",
	51: "day-sprinkle",
	53: "day-showers",
	55: "day-thunderstorm",
	56: "snowflake-cold",
	57: "snowflake-cold",
	61: "day-sprinkle",
	63: "day-showers",
	65: "day-thunderstorm",
	66: "day-rain-mix",
	67: "day-rain-mix",
	71: "day-snow-wind",
	73: "day-snow-wind",
	75: "day-snow",
	77: "day-sleet",
	80: "day-sprinkle",
	81: "day-showers",
	82: "day-thunderstorm",
	85: "day-snow",
	86: "day-snow",
	95: "thunderstorm",
	96: "thunderstorm",
	99: "thunderstorm"
};

function toC (celsius, fahrenheit) {
	if (celsius != null && Number.isFinite(Number(celsius))) return Number(celsius);
	if (fahrenheit != null && Number.isFinite(Number(fahrenheit))) return (Number(fahrenheit) - 32) * 5 / 9;
	return null;
}

/**
 * Weather provider that reads the same NODE daemon weather the rest of NODE uses.
 * URL comes from config.nodeUrl / NODE_URL. No coordinates or city names are hardcoded.
 */
class NodeosProvider extends WeatherProvider {
	constructor (config) {
		super();
		this.config = {
			nodeUrl: process.env.NODE_URL || process.env.NODEOS_URL || "http://127.0.0.1:17770",
			updateInterval: 10 * 60 * 1000,
			type: "current",
			...config
		};
		this.locationName = "NODE";
	}

	async initialize () {
		const base = String(this.config.nodeUrl || "").replace(/\/+$/, "");
		const url = `${base}/api/weather`;
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
			if (res.ok) {
				const data = await res.json();
				if (data && data.location) this.locationName = String(data.location);
			}
		} catch (error) {
			Log.warn(`[nodeos weather] initial fetch failed: ${error.message}`);
		}
		this._createJSONFetcher({
			url,
			reloadInterval: this.config.updateInterval
		}, (data) => this.#onWeather(data));
	}

	#onWeather (data) {
		if (!data || typeof data !== "object") {
			Log.warn("[nodeos weather] empty payload");
			return;
		}
		if (data.location) this.locationName = String(data.location);
		const current = {
			date: new Date(),
			temperature: toC(data.tempC, data.tempF),
			minTemperature: toC(data.lowC, data.lowF),
			maxTemperature: toC(data.highC, data.highF),
			weatherType: WEATHER_TYPES[data.code] || "day-sunny",
			humidity: data.humidity ?? null
		};
		const type = String(this.config.type || "current").toLowerCase();
		if (type === "forecast" || type === "daily") {
			this.onDataCallback?.([current]);
		} else {
			this.onDataCallback?.(current);
		}
	}
}

module.exports = NodeosProvider;
