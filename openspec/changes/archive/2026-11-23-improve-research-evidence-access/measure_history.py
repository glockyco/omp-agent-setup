#!/usr/bin/env python3
"""Count literature-related tool calls in OMP session transcripts. Prints JSON."""
import collections, glob, json, os, re, sys

root = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else "~/.omp/agent/sessions")
url_re = re.compile(r"https?://[^\s\"'<>)\\]+")
SCH = re.compile(r"(?i)openalex|dblp|crossref|semanticscholar|arxiv|unpaywall|sci-hub|scihub|doi\.org|dl\.acm\.org|ieeexplore|springer|sciencedirect|aclanthology|openreview|scholar\.google|researchgate|fetch_pdf|skill://research-evidence")
tcid_re = re.compile(r'"toolCallId":\s*"([^"]+)"')
STRICT = re.compile(r"Failed to fetch URL \(HTTP (\d+)\)|HTTP Error (429|403|503)|\"code\":\s*\"?429|429 Too Many|Too Many Requests|FAILED status=|timed out")
BLOCK = re.compile(r"(?i)\b(403|429|401|451|503)\b|forbidden|too many requests|rate limit|just a moment|captcha|access denied|cloudflare")
ok_re = re.compile(r"OK (\S+): (\d+) KB from (OA publisher|sci-hub|OA repository|arxiv)")
fail_re = re.compile(r"FAIL (\S+): ")
EXEC = {"read", "eval", "bash"}


def classify(u):
    ul = u.lower()
    if "api.openalex.org" in ul:
        if "cites:" in ul: return "OpenAlex citing works"
        if re.search(r"/works/(https?:|doi:|w\d|\{|\$)", ul) or "filter=doi:" in ul: return "OpenAlex lookup"
        if "search=" in ul or ".search:" in ul: return "OpenAlex keyword search"
        return "OpenAlex other"
    if "api.crossref.org" in ul:
        if re.search(r"/works/(10\.|\{|\$|%)", ul): return "Crossref DOI"
        return "Crossref query" if "query" in ul else "Crossref other"
    if "dblp." in ul: return "DBLP search" if "search/publ" in ul else "DBLP other"
    if "export.arxiv.org" in ul: return "arXiv API lookup" if ("id_list" in ul and "search_query" not in ul) else "arXiv API search"
    if "arxiv.org/html" in ul: return "arXiv HTML"
    if "arxiv.org/abs" in ul: return "arXiv abs"
    if "arxiv.org/pdf" in ul: return "arXiv PDF"
    if "arxiv.org" in ul: return "arXiv other"
    if "semanticscholar" in ul: return "S2 search" if "paper/search" in ul else "S2 lookup"
    for k, v in (("dl.acm.org", "ACM DL"), ("ieeexplore", "IEEE Xplore"), ("springer", "Springer"), ("sciencedirect", "ScienceDirect"), ("aclanthology", "ACL Anthology"), ("openreview", "OpenReview"), ("researchgate", "ResearchGate"), ("scholar.google", "Google Scholar")):
        if k in ul: return v
    return None


def fam(kinds):
    f = set()
    for k in kinds:
        for p, n in (("OpenAlex", "OpenAlex"), ("S2", "SemanticScholar"), ("arXiv API", "arXiv API"), ("Crossref", "Crossref"), ("DBLP", "DBLP")):
            if k.startswith(p): f.add(n)
    return f


files = glob.glob(root + "/**/*.jsonl", recursive=True)
out = collections.Counter(); names = collections.Counter(); cls = collections.Counter(); cls_sess = collections.defaultdict(set)
refused = collections.defaultdict(collections.Counter); fails = collections.defaultdict(collections.Counter)
fp = collections.Counter(); email = collections.Counter(); months = collections.Counter(); acm_month = collections.Counter()
skill_sessions = set(); sch_by_session = collections.Counter(); sub_sch = collections.Counter(); sub_skill = set()
first_ts, last_ts = "9", "0"
for fi, f in enumerate(files):
    rel = os.path.relpath(f, root).split(os.sep)
    sid = (rel[0], rel[1][:60]); sub = len(rel) > 2; out["subagent files"] += sub
    want = {}
    try:
        fh = open(f, encoding="utf-8", errors="replace")
    except OSError:
        continue
    with fh:
        for line in fh:
            head = line[:600]
            if '"role":"assistant"' in head:
                if '"toolCall"' not in line: continue
                try: o = json.loads(line)
                except ValueError: continue
                ts = o.get("timestamp", "")
                if ts: first_ts, last_ts = min(first_ts, ts), max(last_ts, ts)
                for c in (o.get("message") or {}).get("content") or []:
                    if not isinstance(c, dict) or c.get("type") != "toolCall": continue
                    n = c.get("name"); names[n] += 1
                    if n and n.startswith("mcp"): out["mcp calls"] += 1
                    if n == "web_search": out["web_search"] += 1; continue
                    s = json.dumps(c.get("arguments") or {}, ensure_ascii=False)
                    if not SCH.search(s): continue
                    if n == "read" and "skill://research-evidence" in s and "scripts" not in s:
                        skill_sessions.add(sid)
                        if sub: sub_skill.add(fi)
                    if n not in EXEC: continue
                    kinds = {classify(u) for u in set(url_re.findall(s))} - {None}
                    if kinds:
                        sch_by_session[sid] += 1
                        if sub: sub_sch[fi] += 1
                    for k in kinds: cls[k] += 1; cls_sess[k].add(sid)
                    if "api_key=" in s and "openalex" in s.lower(): out["openalex calls with api_key"] += 1
                    if n in ("bash", "eval") and "fetch_pdf.py" in s:
                        m = re.search(r"UNPAYWALL_EMAIL[\"']?\]?\s*[=:]\s*[\\\"']*[^\s\"'\\;&@]+@([^\s\"'\\;&]+)", s)
                        email["typed, domain " + m.group(1) if m else ("mentioned" if "UNPAYWALL_EMAIL" in s else "not set in command")] += 1
                    want[c.get("id")] = (n, kinds, ts, "fetch_pdf" in s)
            elif '"role":"toolResult"' in head:
                mm = tcid_re.search(head)
                if not mm or mm.group(1) not in want: continue
                try: o = json.loads(line)
                except ValueError: continue
                m = o.get("message") or {}
                txt = " ".join(x.get("text", "") for x in (m.get("content") or []) if isinstance(x, dict) and x.get("type") == "text")
                n, kinds, ts, is_fp = want[mm.group(1)]
                if "No API key, so this request shares" in txt[:3000]: out["openalex key notices"] += 1
                if n == "read" and len(kinds) == 1:
                    k = next(iter(kinds)); r = refused[k]; r["n"] += 1
                    if m.get("isError") or (len(txt) < 400 and BLOCK.search(txt)): r["refused"] += 1
                    if len(txt) < 1500: r["under1500"] += 1
                    if k == "ACM DL": acm_month[ts[:7]] += 1
                per = ts[:7] if ts < "2026-11-19" else "2026-11-19+"
                bad = bool(m.get("isError")) or bool(STRICT.search(txt[:3000] + txt[-800:]))
                for fm in fam(kinds): fails[fm + " " + per]["n"] += 1; fails[fm + " " + per]["bad"] += bad
                if is_fp:
                    for key, kb, src in ok_re.findall(txt):
                        y = re.search(r"(19|20)\d\d", key); band = "no year" if not y else ("2022+" if int(y.group()) >= 2022 else "<2022")
                        fp[src] += 1; fp[band + " " + src] += 1
                    for key in fail_re.findall(txt):
                        y = re.search(r"(19|20)\d\d", key); band = "no year" if not y else ("2022+" if int(y.group()) >= 2022 else "<2022")
                        fp["FAIL"] += 1; fp[band + " FAIL"] += 1
act = [s for s, v in sch_by_session.items() if v >= 5]
subact = [i for i, v in sub_sch.items() if v >= 5]
print(json.dumps({
    "files": len(files), "subagent files": out["subagent files"], "span": [first_ts[:10], last_ts[:10]],
    "tool calls": sum(names.values()), "mcp calls": out["mcp calls"], "web_search": out["web_search"],
    "classes": {k: [v, len(cls_sess[k])] for k, v in cls.most_common()},
    "reads refused": {k: dict(v) for k, v in refused.items() if k in ("ACM DL", "ScienceDirect", "ResearchGate", "Google Scholar", "OpenReview", "IEEE Xplore", "arXiv HTML", "Springer", "ACL Anthology")},
    "acm by month": dict(sorted(acm_month.items())),
    "index failures": {k: [v["bad"], v["n"]] for k, v in sorted(fails.items())},
    "fetch_pdf": dict(fp), "unpaywall email": dict(email),
    "openalex key notices": out["openalex key notices"], "openalex calls with api_key": out["openalex calls with api_key"],
    "sessions reading the skill": len(skill_sessions), "sessions >=5 scholarly": len(act), "of which read skill": sum(s in skill_sessions for s in act),
    "subagent transcripts >=5 scholarly": len(subact), "of which read skill (sub)": sum(i in sub_skill for i in subact),
}, indent=1))
