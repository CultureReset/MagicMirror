/* Portable NODE display config for MagicMirror².
 * Every host, port, URL, timezone and unit comes from the environment.
 * There are no machine home paths, Tailscale names, or screen sizes in here.
 *
 *   NODE_URL          NODE daemon, default http://127.0.0.1:17770
 *   MM_ADDRESS        listen address, default 127.0.0.1
 *   MM_PORT           listen port, default 18080 (8080 is often taken)
 *   MM_ICS_HOST       host used by the hidden calendar module to fetch
 *                     /mmm-node/calendar.ics, default 127.0.0.1
 *   MM_IP_WHITELIST   comma-separated list; set to [] or * to allow all
 *   MM_UNITS          imperial | metric (default imperial)
 *   MM_TIME_FORMAT    12 or 24 (default 12)
 *   MM_LOCALE         default en-US
 *   MM_LANGUAGE       default en
 *   MM_TIMEZONE       optional IANA zone (else TZ, else the host clock)
 *   MM_FIRST_DAY      0 Sunday, 1 Monday; omit for locale default
 *   NODE_CALENDAR_ICS optional extra ICS URLs, comma-separated
 */
function env (name, fallback) {
	const value = process.env[name];
	if (value === undefined || value === "") return fallback;
	return value;
}

function envList (name, fallback) {
	const value = process.env[name];
	if (value === undefined || value === "") return fallback;
	const trimmed = value.trim();
	if (trimmed === "[]" || trimmed === "*") return [];
	return trimmed.split(",").map((part) => part.trim()).filter(Boolean);
}

const nodeUrl = String(env("NODE_URL", env("NODEOS_URL", "http://127.0.0.1:17770"))).replace(/\/+$/, "");
const mmAddress = env("MM_ADDRESS", "127.0.0.1");
const mmPort = Number(env("MM_PORT", env("MAGICMIRROR_PORT", "18080")));
const mmIcsHost = env("MM_ICS_HOST", "127.0.0.1");
const units = env("MM_UNITS", "imperial");
const timeFormat = Number(env("MM_TIME_FORMAT", "12"));
const locale = env("MM_LOCALE", "en-US");
const language = env("MM_LANGUAGE", "en");
const timezone = env("MM_TIMEZONE", env("TZ", null));
const firstDayRaw = env("MM_FIRST_DAY", null);
const firstDayOfWeek = firstDayRaw == null ? null : Number(firstDayRaw);

const calendars = [
	{
		name: "NODE",
		symbol: "calendar-check",
		color: "#4C8DFF",
		url: `http://${mmIcsHost}:${mmPort}/mmm-node/calendar.ics`,
		fetchInterval: 60 * 1000
	},
	...envList("NODE_CALENDAR_ICS", []).map((url, index) => ({
		name: `Calendar ${index + 1}`,
		url,
		color: "#8e5cf6",
		fetchInterval: 5 * 60 * 1000
	}))
];

const clockConfig = {
	displaySeconds: true,
	showPeriod: timeFormat === 12,
	showDate: true,
	dateFormat: "dddd, MMMM D",
	timeFormat,
	displayType: "digital"
};
if (timezone) clockConfig.timezone = timezone;

const calendarExtConfig = {
	mode: "month",
	monthIndex: 0,
	locale,
	showWeekNumber: false,
	fontSize: "18px",
	eventHeight: "22px",
	calendarSet: ["NODE"],
	maxEventLines: 4
};
if (firstDayOfWeek != null && !Number.isNaN(firstDayOfWeek)) {
	calendarExtConfig.firstDayOfWeek = firstDayOfWeek;
}

const config = {
	address: mmAddress,
	port: mmPort,
	basePath: "/",
	ipWhitelist: envList("MM_IP_WHITELIST", ["127.0.0.1", "::ffff:127.0.0.1", "::1"]),
	useHttps: false,
	language,
	locale,
	logLevel: ["INFO", "LOG", "WARN", "ERROR"],
	timeFormat,
	units,
	modules: [
		{ module: "alert" },
		{
			module: "clock",
			position: "top_left",
			config: clockConfig
		},
		{
			module: "weather",
			position: "top_right",
			config: {
				weatherProvider: "nodeos",
				type: "current",
				nodeUrl,
				updateInterval: 10 * 60 * 1000,
				showHumidity: "none",
				showSun: false,
				showFeelsLike: false,
				showWindDirection: false,
				onlyTemp: true,
				roundTemp: true,
				appendLocationNameToHeader: true
			}
		},
		{
			// Hidden feeder. CalendarExt3 renders the events it broadcasts.
			module: "calendar",
			config: {
				maximumEntries: 200,
				maximumNumberOfDays: 62,
				broadcastPastEvents: true,
				calendars
			}
		},
		{
			module: "MMM-CalendarExt3",
			position: "middle_center",
			config: calendarExtConfig
		},
		{
			module: "MMM-CalendarExt3Agenda",
			position: "bottom_left",
			header: "Agenda",
			config: {
				instanceId: "node-agenda",
				startDayIndex: 0,
				endDayIndex: 14,
				onlyEventDays: 7,
				calendarSet: ["NODE"],
				locale,
				showMiniMonthCalendar: false,
				useSymbol: true
			}
		},
		{
			module: "MMM-NODE",
			position: "bottom_right",
			header: "NODE",
			config: {
				nodeUrl,
				updateInterval: 15 * 1000
			}
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
