import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProvenance } from "../src/provenance.mjs";
import { buildAddons } from "../src/build.mjs";
import { addonEntries, addonZip } from "../src/addon.mjs";

test("provenance records identities and effective options without copying private inputs", () => {
	const r = buildProvenance({
		runs: { rxp: { version: "4.11.32", guides: [{ text: "PRIVATE GUIDE" }] }, journey: { version: null } },
		manifest: { polestar: { commit: "abcdef", dir: "C:/private" }, builtAt: "2026-11-06", foreverBuild: "1.60.0", build: "1.15.0", iface: "11507", questie: true, dir: "C:/private", files: ["PRIVATE GUIDE"] },
		opts: { sources: ["rxp", "journey"], routes: ["survival"], selfFound: true, ah: "no", groups: "yes", path: "C:/private" }, locales: ["deDE"],
	});
	assert.equal(r.converter.name, "polestar-convert");
	assert.equal(r.converter.upstreamVersion, "0.2.0");
	assert.equal(r.converter.revision, null);
	assert.match(r.converter.revisionStatus, /unavailable/);
	assert.deepEqual(r.sourceAddons, { rxp: { version: "4.11.32" }, journey: { version: null } });
	assert.equal(r.gameDataManifest.polestarCommit, "abcdef");
	assert.equal(r.gameDataManifest.foreverBuild, "1.60.0");
	assert.equal(r.compiler.manifestPolestarCommit, "abcdef");
	assert.equal(r.compiler.binaryDigest, null);
	assert.deepEqual(r.options, { sources: ["rxp", "journey"], routes: ["survival"], selfFound: true, ah: false, groups: true, locales: ["deDE"] });
	assert.doesNotMatch(JSON.stringify(r), /PRIVATE GUIDE|C:\/private/);
});

test("unknown provenance stays explicit and defaults reflect converter behavior", () => {
	const r = buildProvenance({ runs: {}, manifest: {}, opts: {} });
	assert.equal(r.gameDataManifest.polestarCommit, null);
	assert.deepEqual(r.options.routes, ["main", "dungeon", "survival"]);
	assert.equal(r.options.ah, true);
	assert.equal(r.options.groups, "asked per quest");
	assert.deepEqual(r.options.locales, []);
	assert.deepEqual(buildProvenance({ runs: {}, manifest: {}, opts: { routes: [] } }).options.routes, ["main", "dungeon", "survival"]);
});

test("explicit revisions are attributed to the caller and reject paths", () => {
	const r = buildProvenance({ runs: {}, manifest: {}, converterRevision: "abcdef1234567" });
	assert.equal(r.converter.revision, "abcdef1234567");
	assert.match(r.converter.revisionStatus, /caller-supplied/);
	assert.throws(() => buildProvenance({ runs: {}, manifest: {}, converterRevision: "C:/private" }), /commit hash/);
});

const inputs = (Compiler) => ({
	read: async (p) => p.endsWith("GuideList-forever.xml") ? "<Ui/>" : p.endsWith("RXPGuides.toc") ? "## Version: 4.11.32" : null,
	paths: [], readData: async (p) => /^data\/forever\/(quests|npcs|zones|map-frames|items|races|objects)\.json$/.test(p) ? "{}" : null,
	manifest: { iface: "11507", polestar: { commit: "abcdef" } }, Compiler,
	pack: { id: "my-guides", title: "My Guides", author: "Me" }, opts: { sources: ["rxp"] },
});
class Compiler {
	setSpellNames() {}
	setPack() { return "[]"; }
	compile() { return "[]"; }
	packFiles() { return JSON.stringify({ files: [["Guides.lua", "-- guides"]], warnings: [] }); }
	folder() { return "Polestar_MyGuides"; }
}

test("shared build includes provenance in addon entries and browser ZIP", async () => {
	const r = await buildAddons(inputs(Compiler));
	const entries = addonEntries(r.folder, r.files);
	const text = entries["Polestar_MyGuides/reports/build-provenance.json"];
	assert.deepEqual(JSON.parse(text), r.provenance);
	assert.equal(r.provenance.sourceAddons.rxp.version, "4.11.32");
	assert.ok(new TextDecoder().decode(addonZip(r.folder, r.files)).includes("reports/build-provenance.json"));
});

test("compiler refusals retain provenance for CLI reports", async () => {
	class RefusingCompiler extends Compiler {
		setPack() { return JSON.stringify([{ severity: "error", file: "pack.json", message: "refused" }]); }
	}
	const r = await buildAddons(inputs(RefusingCompiler));
	assert.equal(r.errors.length, 1);
	assert.equal(r.provenance.sourceAddons.rxp.version, "4.11.32");
});
