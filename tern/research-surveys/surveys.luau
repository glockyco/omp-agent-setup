--!strict
-- Reads the surveys of this machine: the registry that the research-evidence survey program appends each survey
-- directory to, and the status.json it keeps current in each directory. Both halves use it.

export type Survey = {
	dir: string,
	question: string,
	state: string, -- running, done, stopped, blocked, failed, or interrupted for a running survey gone quiet
	stage: string,
	message: string,
	round: number,
	screened: number,
	budget: number?,
	core: number,
	related: number,
	updated: number, -- seconds since the epoch
}

local M = {}

-- A running survey rewrites its status at least every 30 seconds. One silent for longer than this has lost its process.
M.STALE_SECONDS = 120
-- Surveys that ended longer ago than this no longer show.
M.RECENT_SECONDS = 86400

-- The survey program finds the home directory as Python does: USERPROFILE on Windows, HOME elsewhere.
local function home(): string
	return tern.getenv("USERPROFILE") or tern.getenv("HOME") or ""
end

function M.registry(): string
	return tern.getenv("RESEARCH_EVIDENCE_REGISTRY") or (home() .. "/.cache/research-evidence/surveys.jsonl")
end

-- Seconds since the epoch of an ISO 8601 UTC time (`2026-11-24T14:03:11Z`), by the days-from-civil algorithm,
-- because `os.time` with a table reads local time.
function M.epoch(iso: string): number?
	local y, m, d, hh, mm, ss = string.match(iso, "^(%d+)-(%d+)-(%d+)T(%d+):(%d+):(%d+)")
	if not (y and m and d and hh and mm and ss) then
		return nil
	end
	local year, month, day = tonumber(y) :: number, tonumber(m) :: number, tonumber(d) :: number
	if month <= 2 then
		year -= 1
	end
	local era = year // 400
	local yoe = year - era * 400
	local doy = (153 * (if month > 2 then month - 3 else month + 9) + 2) // 5 + day - 1
	local doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
	local days = era * 146097 + doe - 719468
	return days * 86400 + (tonumber(hh) :: number) * 3600 + (tonumber(mm) :: number) * 60 + (tonumber(ss) :: number)
end

local function read_json(path: string, limit: number): any?
	local ok, text = pcall(tern.fs.read, path, limit)
	if not ok then
		return nil
	end
	local parsed, value = pcall(tern.json.decode, text)
	return if parsed then value else nil
end

-- The surveys of the last day and every running one, newest first.
function M.load(): { Survey }
	local ok, text = pcall(tern.fs.read, M.registry(), 4 * 1024 * 1024)
	if not ok then
		return {}
	end
	local now = os.time()
	local seen: { [string]: boolean } = {}
	local surveys: { Survey } = {}
	for line in string.gmatch(text, "[^\r\n]+") do
		local parsed, row = pcall(tern.json.decode, line)
		local dir = if parsed and type(row) == "table" then row.dir else nil
		if type(dir) == "string" and not seen[dir] then
			seen[dir] = true
			local status = read_json(dir .. "/status.json", 256 * 1024)
			if type(status) == "table" then
				local updated = M.epoch(tostring(status.updated or "")) or 0
				local state: string = tostring(status.state or "running")
				if state == "running" and now - updated > M.STALE_SECONDS then
					state = "interrupted"
				end
				local shown = state == "running" or now - updated <= M.RECENT_SECONDS
				if shown then
					table.insert(surveys, {
						dir = dir,
						question = tostring(status.question or row.question or dir),
						state = state,
						stage = tostring(status.stage or ""),
						message = tostring(status.message or ""),
						round = tonumber(status.round) or 0,
						screened = tonumber(status.screened) or 0,
						budget = tonumber(status.budget),
						core = tonumber(status.core) or 0,
						related = tonumber(status.related) or 0,
						updated = updated,
					})
				end
			end
		end
	end
	table.sort(surveys, function(a: Survey, b: Survey): boolean
		return a.updated > b.updated
	end)
	return surveys
end

-- `text` cut to at most `length` characters, ending in "..." when cut, because Tern leaves out card rows over 200.
function M.short(text: string, length: number): string
	if (utf8.len(text) or #text) <= length then
		return text
	end
	local cut = utf8.offset(text, length - 2) or (length - 2)
	return string.sub(text, 1, cut - 1) .. "..."
end

return M
