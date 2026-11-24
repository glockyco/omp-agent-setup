--!strict
-- The host half: a widget that shows this machine's literature surveys in every window attached to it, with buttons
-- that open a survey's results or coverage and stop a running survey.

local surveys = require("./surveys")
type Survey = surveys.Survey

local POLL_MS = 3000
local SHOWN = 8

local TONES: { [string]: string } = {
	running = "accent",
	done = "ok",
	stopped = "muted",
	blocked = "warn",
	failed = "error",
	interrupted = "warn",
}
local LABELS: { [string]: string } = {
	running = "Running",
	done = "Done",
	stopped = "Stopped",
	blocked = "Blocked",
	failed = "Failed",
	interrupted = "Interrupted",
}

local current: { Survey } = {}
local by_row: { [string]: Survey } = {}
local signature = ""
local timer: TimerHandle? = nil

local function row_id(dir: string): string
	return string.sub(tern.sha256(dir), 1, 16)
end

local function found(s: Survey): string
	return string.format("%d core, %d related", s.core, s.related)
end

local function step(s: Survey): string
	if s.stage == "start" then
		return "starting"
	elseif s.stage == "plan" then
		return "planning"
	end
	return string.format("round %d, %d core", s.round, s.core)
end

local function failed(s: Survey): boolean
	return s.state == "blocked" or s.state == "failed"
end

-- A survey's line under its question: its step while it runs, the start of the reason when it could not finish, else
-- its core works. Longer text would squeeze the state label beside it, and Details shows the whole reason.
local function detail(s: Survey): string
	if s.state == "running" then
		return step(s)
	elseif failed(s) then
		return surveys.short(s.message, 22)
	end
	return string.format("%d core", s.core)
end

local function share(s: Survey): number?
	if s.state == "done" then
		return 1
	end
	return if s.budget and s.budget > 0 then math.min(1, s.screened / s.budget) else nil
end

local function actions(s: Survey): { WidgetCardButton }
	if s.state == "running" then
		return { { id = "stop", label = "Stop" } }
	elseif failed(s) then
		return { { id = "details", label = "Details" } }
	end
	return { { id = "results", label = "Results" }, { id = "coverage", label = "Coverage" } }
end

-- The card is about 300 pixels wide and cuts each row to one line, so a survey takes two rows: its question, then its
-- state, detail and buttons.
local function rows(): { WidgetCardRow }
	local card: { WidgetCardRow } = {}
	for i, s in current do
		if i > SHOWN then
			break
		end
		table.insert(card, { text = surveys.short(s.question, 160), tone = TONES[s.state] })
		table.insert(card, {
			id = row_id(s.dir),
			label = LABELS[s.state] or s.state,
			text = detail(s),
			tone = "muted",
			actions = actions(s),
		})
	end
	return card
end

local function render(_pane: StatusPaneInfo?): WidgetView?
	if #current == 0 then
		return nil
	end
	local running: { Survey } = {}
	for _, s in current do
		if s.state == "running" then
			table.insert(running, s)
		end
	end
	if #running > 0 then
		local latest = running[1]
		local count = if #running == 1 then "Survey" else #running .. " surveys"
		return { text = count .. ": " .. step(latest), tone = "accent", value = share(latest), card = rows() }
	end
	local latest = current[1]
	local word = "Survey " .. string.lower(LABELS[latest.state] or latest.state)
	return {
		text = if failed(latest) then word else word .. ": " .. found(latest),
		tone = TONES[latest.state],
		value = share(latest),
		card = rows(),
	}
end

local function poll()
	local ok, loaded = pcall(surveys.load)
	if ok then
		local parts: { string } = {}
		local rows: { [string]: Survey } = {}
		for _, s in loaded do
			table.insert(parts, table.concat({ s.dir, s.state, s.stage, tostring(s.round), tostring(s.screened), tostring(s.core), tostring(s.related) }, "|"))
			rows[row_id(s.dir)] = s
		end
		current, by_row = loaded, rows
		local next_signature = table.concat(parts, "\n")
		if next_signature ~= signature then
			signature = next_signature
			tern.chrome.refresh()
		end
	end
	timer = tern.timer(POLL_MS, poll)
end

local STYLES: { WidgetStyle } = { "ring", "bar", "text" }
local spec: WidgetSpec = {
	name = "Research surveys",
	description = "Literature surveys of this machine: the running one's step and screened share, and the results of the last day.",
	icon = "search",
	styles = STYLES,
	render = render,
}
tern.chrome.widget("surveys", spec)

tern.on("widget_action", function(ev: WidgetActionEvent, cx: EffectCx): boolean?
	if ev.widget ~= "surveys" then
		return nil
	end
	local s = by_row[ev.row]
	if not s then
		return nil
	end
	if ev.act == "stop" then
		if s.state == "running" then
			tern.fs.write(s.dir .. "/stop", "")
			cx:toast("info", "Stopping the survey", surveys.short(s.question, 80))
		end
		return true
	end
	local files: { [string]: string } = { results = "/kept.md", coverage = "/coverage.md", details = "/status.json" }
	local file = s.dir .. (files[ev.act] or "/kept.md")
	if tern.fs.exists(file) then
		-- Opens the file in the window whose card was clicked.
		cx:open(file, if ev.window then { window = ev.window } else nil)
	else
		cx:toast("info", "No results yet", "The survey writes them when it ends.")
	end
	return true
end)

tern.on("unload", function(_cx: EffectCx?)
	if timer then
		timer:cancel()
	end
end)

poll()
