--!strict
-- The window half: a toast when a survey of this window's machine ends. Only hooks with a window context can toast,
-- so this half watches the same files as the host half.

local surveys = require("./surveys")

local POLL_MS = 5000
local LEVELS: { [string]: ToastLevel } = {
	done = "success",
	stopped = "info",
	blocked = "error",
	failed = "error",
	interrupted = "error",
}

-- The state of each survey at the last poll. Nil until the first poll, which only records them.
local last: { [string]: string }? = nil
local timer: TimerHandle? = nil

local function poll(cx: WindowCx?)
	local ok, loaded = pcall(surveys.load)
	if ok then
		local states: { [string]: string } = {}
		for _, s in loaded do
			states[s.dir] = s.state
			if cx and last and last[s.dir] == "running" and s.state ~= "running" then
				local detail = if s.state == "done"
					then string.format("%d core and %d related works", s.core, s.related)
					else s.message
				cx:toast(LEVELS[s.state] or "info", "Survey " .. s.state .. ": " .. surveys.short(s.question, 60), surveys.short(detail, 160))
			end
		end
		last = states
	end
	timer = tern.timer(POLL_MS, poll)
end

-- Polling starts at load rather than on window_start, because a reload in an open window sends no new window_start.
timer = tern.timer(POLL_MS, poll)

tern.on("unload", function(_cx: WindowCx?)
	if timer then
		timer:cancel()
	end
end)
