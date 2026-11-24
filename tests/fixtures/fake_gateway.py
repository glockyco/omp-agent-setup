"""A stand-in for `omp auth-gateway stdio`: answers the survey's plan and screening requests on JSON lines.

A title containing CORE meets both criteria, REL is worth reading. The plan comes back inside a code fence, as some
providers send it.
"""

import json
import re
import sys

PLAN = {
    "descriptions": ["d1"],
    "keywords": ["k1"],
    "criteria": [{"name": "topic", "description": "on topic"}, {"name": "method", "description": "uses a model"}],
}

print(json.dumps({"ready": True, "version": "test"}), flush=True)
for line in sys.stdin:
    request = json.loads(line)
    content = request["body"]["messages"][0]["content"]
    if content.startswith("Plan a literature search"):
        text = "```json\n" + json.dumps(PLAN) + "\n```"
    else:
        titles = re.findall(r"^\[(\d+)\] Title: (.*)$", content, re.M)
        text = json.dumps({"results": [{"n": int(n), "criteria": ["CORE" in t] * 2, "read": "REL" in t} for n, t in titles]})
    answer = {"id": request["id"], "status": 200, "body": {"model": "fake", "choices": [{"message": {"content": text}}]}}
    print(json.dumps(answer), flush=True)
