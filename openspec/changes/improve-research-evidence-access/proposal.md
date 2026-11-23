# Proposal

## Why

Three months of session history show agents repeating the same access failures in literature work. They fetch publisher hosts that always refuse, call OpenAlex without a key until the daily budget is gone, type the Unpaywall address themselves, and treat a manuscript as an ordinary result when the DOI names a published work. The skill is silent on all of this, and every subagent starts without the lesson. The measurements are in [evidence.md](evidence.md).

## What Changes

- The skill names the hosts that refuse scripted requests and gives the route for each need: metadata from an index, full text through the acquisition order, the browser session or the person.
- The skill accepts HTML full text from an open host as read text and says how to record the location and the version.
- The acquisition helper reports a distinct result when a publisher DOI yields only a manuscript, and the skill directs the agent to ask before citing from that copy.
- The acquisition helper says when Unpaywall could not be reached, instead of reporting that no open-access copy exists.
- Before a preprint is registered, the workflow looks for its published version.
- OpenAlex calls carry the key from the `vault` tool in a request header. The key never enters a URL, a tool argument or a log.
- The Unpaywall address comes from the host environment only. An agent that finds it unset stops and reports it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `research-evidence`: adds routes around refusing hosts, online full text as a reading source, version-of-record disclosure, visible open-access lookup failures, the published-version check and keyed OpenAlex access. Tightens the explicit service identity.

## Impact

- `plugin/skills/research-evidence/SKILL.md` and `plugin/skills/research-evidence/scripts/fetch_pdf.py`, with `tests/test_fetch_pdf.py`.
- The plugin, marketplace and root package versions advance together.
- Hosts must provide `UNPAYWALL_EMAIL` before this release reaches them, because agents no longer supply the address. That setting belongs to the workstation repository.
- The OpenAlex key must exist as an entry in the `private` Bitwarden vault. The plugin does not create it.
- The acquisition order of the accepted spec stays as it is.
