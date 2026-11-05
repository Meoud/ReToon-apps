// Trash calendar for ReToon: next pickups from an ICS feed + evening reminder.
const S = () => retoon.settings;

const DAY_NL = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const DAY_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON_NL = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let events = [];        // { date: Date at local midnight, name }
let error = null;       // text shown on the card when the last fetch failed
let loading = false;
let notifiedFor = "";   // date key we already reminded about
let snoozeUntil = 0;

function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function dayKey(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
function daysFromToday(d) { return Math.round((d - midnight(new Date())) / 86400000); }

function parseICS(text) {
	const lines = text.replace(/\r/g, "").replace(/\n[ \t]/g, "").split("\n");
	const out = [];
	let cur = null;
	for (const line of lines) {
		if (line === "BEGIN:VEVENT") { cur = {}; continue; }
		if (line === "END:VEVENT") {
			if (cur && cur.date && cur.name) out.push(cur);
			cur = null;
			continue;
		}
		if (!cur) continue;
		const i = line.indexOf(":");
		if (i < 0) continue;
		const key = line.slice(0, i).split(";")[0].toUpperCase();
		const val = line.slice(i + 1);
		if (key === "DTSTART") {
			const m = /^(\d{4})(\d\d)(\d\d)(?:T(\d\d)(\d\d)(\d\d)(Z?))?/.exec(val);
			if (!m) continue;
			if (m[7] === "Z") {   // UTC time: convert to the Toon's local day
				cur.date = midnight(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])));
			} else {
				cur.date = new Date(+m[1], +m[2] - 1, +m[3]);
			}
		} else if (key === "SUMMARY") {
			cur.name = val.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";")
				.replace(/\\\\/g, "\\").trim();
		}
	}
	return out;
}

function load() {
	const url = (S().url || "").trim().replace(/^webcal:/i, "https:");
	if (!url) { error = "Set the calendar link in Apps"; events = []; retoon.update(); return; }
	if (loading) return;
	loading = true;
	retoon.fetch(url, { timeout: 30 }).then(r => {
		loading = false;
		if (r.status !== 200) { error = "Calendar: HTTP " + r.status; }
		else {
			const ev = parseICS(r.text);
			if (!ev.length) { error = "No events in calendar"; }
			else { events = ev; error = null; }
		}
		retoon.update();
	}).catch(() => {
		loading = false;
		error = "Calendar not reachable";
		retoon.update();
	});
}

// Upcoming pickups grouped per day: [{ date, days, names: [..] }]
function upcoming(max) {
	const byDay = {};
	for (const e of events) {
		const n = daysFromToday(e.date);
		if (n < 0) continue;
		const k = dayKey(e.date);
		if (!byDay[k]) byDay[k] = { date: e.date, days: n, names: [] };
		if (byDay[k].names.indexOf(e.name) < 0) byDay[k].names.push(e.name);
	}
	return Object.keys(byDay).map(k => byDay[k])
		.sort((a, b) => a.date - b.date).slice(0, max);
}

function label(g) {
	const nl = S().dutch;
	if (g.days === 0) return nl ? "Vandaag" : "Today";
	if (g.days === 1) return nl ? "Morgen" : "Tomorrow";
	const d = g.date;
	return (nl ? DAY_NL : DAY_EN)[d.getDay()] + " " + d.getDate() + " " + (nl ? MON_NL : MON_EN)[d.getMonth()];
}

function rows(el, groups, y0, step, font) {
	groups.forEach((g, i) => {
		const y = y0 + i * step;
		const color = g.days === 0 ? "bad" : g.days === 1 ? "warn" : "muted";
		el.text(label(g), { x: 0, y: y, color: color, font: font });
		el.text(g.names.join(", "), { x: 190, y: y, color: "text", font: font });
	});
}

retoon.tile(el => {
	el.text(S().title, { x: 0, y: 0, color: "muted" });
	el.icon("mdi:trash-can", { align: "top-right", color: "muted" });
	if (error && !events.length) {
		el.text(error, { x: 0, y: 40, color: "bad" });
		return;
	}
	const g = upcoming(3);
	if (!g.length) { el.text("-", { x: 0, y: 40 }); return; }
	rows(el, g, 30, 30, "body");
});

retoon.screen(el => {
	if (error) el.text(error, { x: 0, y: 0, color: "bad" });
	const g = upcoming(10);
	rows(el, g, error ? 40 : 0, 40, "body");
	el.button(S().dutch ? "Vernieuwen" : "Refresh", { align: "bottom-right" }, load);
});

// Evening reminder for tomorrow's pickup.
function check() {
	retoon.update();   // day rollover
	if (!S().remind) return;
	const now = new Date();
	if (now.getHours() < S().hour || now.getTime() < snoozeUntil) return;
	const t = upcoming(1)[0];
	if (!t || t.days !== 1) return;
	const key = dayKey(t.date);
	if (notifiedFor === key) return;
	notifiedFor = key;
	const nl = S().dutch;
	retoon.notify({
		title: nl ? "Afval buiten zetten" : "Trash day tomorrow",
		message: t.names.join(", "),
		level: "warning",
		buttons: nl ? ["Gedaan", "Later"] : ["Done", "Later"],
		tag: "trash"
	}, b => {
		if (b === "Later") { notifiedFor = ""; snoozeUntil = Date.now() + 3600 * 1000; }
	});
}

retoon.onSettings(() => { notifiedFor = ""; load(); });
setInterval(check, 10 * 60 * 1000);
setInterval(load, 6 * 3600 * 1000);
load();
