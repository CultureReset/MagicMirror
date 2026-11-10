/* Portable NODE family-hub display for MagicMirror².
 * Every host, port, URL, timezone and unit comes from the environment.
 * There are no machine home paths, Tailscale names, or screen sizes in here.
 *
 *   NODE_URL              NODE daemon, default http://127.0.0.1:17770
 *   MM_ADDRESS            listen address, default 127.0.0.1
 *   MM_PORT               listen port, default 18080 (8080 is often taken)
 *   MM_ICS_HOST           host used by the hidden calendar module to fetch
 *                         /mmm-node/*.ics, default 127.0.0.1
 *   MM_IP_WHITELIST       comma-separated list; set to [] or * to allow all
 *   MM_UNITS              imperial | metric (default imperial)
 *   MM_TIME_FORMAT        12 or 24 (default 12)
 *   MM_LOCALE             default en-US
 *   MM_LANGUAGE           default en
 *   MM_TIMEZONE           optional IANA zone (else TZ, else the host clock)
 *   MM_FIRST_DAY          0 Sunday, 1 Monday; omit for locale default
 *   NODE_CALENDAR_ICS     optional extra ICS URLs, comma-separated
 *   NODE_DEMO_CALENDAR    1/true to add clearly labeled Demo events (off by default)
 *   MM_WALLPAPER          0/off to disable the wallpaper overlay
 *   MM_WALLPAPER_URL      override wallpaper (default module asset)
 *   MM_IDLE_MS            photo cover delay in ms (default 120000; 0 disables)
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

function isOn (name, fallback = false) {
	const value = env(name, null);
	if (value == null) return fallback;
	return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function isOff (name) {
	const value = env(name, null);
	if (value == null) return false;
	return /^(0|false|no|off|none)$/i.test(String(value).trim());
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
const demoCalendar = isOn("NODE_DEMO_CALENDAR", false);
const wallpaperOff = isOff("MM_WALLPAPER") || isOff("MM_WALLPAPER_URL");
const wallpaperUrl = wallpaperOff ? null : env("MM_WALLPAPER_URL", "/modules/MMM-NODE/assets/wallpaper.jpg");
const idleMsRaw = env("MM_IDLE_MS", "120000");
const idleMs = Number(idleMsRaw);
const nodeBase = {
	nodeUrl,
	updateInterval: 15 * 1000,
	demoCalendar,
	wallpaperUrl
};

const calendars = [
	{
		name: "NODE",
		symbol: "calendar-check",
		color: "#5B9CFF",
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

if (demoCalendar) {
	const ics = (slug) => `http://${mmIcsHost}:${mmPort}/mmm-node/demo/${slug}.ics`;
	calendars.push(
		{ name: "Demo School", symbol: "graduation-cap", color: "#E8A13A", url: ics("school"), fetchInterval: 60 * 1000 },
		{ name: "Demo Family", symbol: "home", color: "#5B9CFF", url: ics("family"), fetchInterval: 60 * 1000 },
		{ name: "Demo Work", symbol: "briefcase", color: "#8E5CF6", url: ics("work"), fetchInterval: 60 * 1000 },
		{ name: "Demo Meals", symbol: "utensils", color: "#3CB37A", url: ics("meals"), fetchInterval: 60 * 1000 }
	);
}

const calendarSet = calendars.map((cal) => cal.name);

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
	mode: "week",
	weekIndex: 0,
	weeksInView: 2,
	locale,
	showWeekNumber: false,
	fontSize: "20px",
	eventHeight: "28px",
	calendarSet,
	maxEventLines: 6,
	displayLegend: true
};
if (firstDayOfWeek != null && !Number.isNaN(firstDayOfWeek)) {
	calendarExtConfig.firstDayOfWeek = firstDayOfWeek;
}

const agendaConfig = {
	instanceId: "node-agenda",
	startDayIndex: 0,
	endDayIndex: 14,
	onlyEventDays: 7,
	calendarSet,
	locale,
	showMiniMonthCalendar: false,
	useSymbol: true
};

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
			module: "weather",
			position: "top_left",
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
			module: "clock",
			position: "top_right",
			config: clockConfig
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
			position: "lower_third",
			header: "Today",
			config: agendaConfig
		},
		{
			module: "MMM-NODE",
			position: "lower_third",
			header: "Meals",
			config: { ...nodeBase, kind: "meals" }
		},
		{
			module: "MMM-NODE",
			position: "lower_third",
			header: "Chores",
			config: { ...nodeBase, kind: "chores" }
		},
		{
			module: "MMM-NODE",
			position: "bottom_left",
			header: "Approvals",
			config: { ...nodeBase, kind: "approvals" }
		},
		{
			module: "MMM-NODE",
			position: "bottom_center",
			header: "Agents",
			config: { ...nodeBase, kind: "agents" }
		},
		{
			module: "MMM-NODE",
			position: "bottom_right",
			header: "System",
			config: { ...nodeBase, kind: "system" }
		},
		{
			// Idle / privacy photo cover. Hidden until MM_IDLE_MS of no input (0 disables).
			module: "MMM-NODE",
			position: "fullscreen_below",
			classes: "mmm-node-idle-slot",
			config: {
				...nodeBase,
				kind: "photos",
				idleMs: Number.isFinite(idleMs) ? idleMs : 120000
			}
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
