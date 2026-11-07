import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGuide } from "../src/rxp/parse.mjs";
import { convertGuide } from "../src/rxp/convert.mjs";
import { Report } from "../src/ir.mjs";

const npc = { id: 201, name: "Example Keeper", roles: ["vendor"], spawns: { 1: { pts: [[10, 10]] } }, rank: 0 };
const data = {
	quests: {}, npcs: { 201: npc }, items: {}, objects: {}, zones: { 1: { name: "Example Zone" } },
	frames: { forever: {}, era: {} }, races: null, inns: [], flights: [], journal: new Map(),
	npcByName: new Map([["example keeper", [npc]]]),
};
function convert(body) {
	const report = new Report();
	const result = convertGuide(parseGuide(`#name 1-2 Example Zone\nstep\n${body}`), data, { report, slug: "example", packId: "test" });
	return { text: result.text, report: JSON.stringify(report) };
}

test("one exact target preserves the real gossip option ID", () => {
	const out = convert(".target Example Keeper::201\n.skipgossipid 8123 >>Ask about the gate");
	assert.match(out.text, /talk 201 gossip 8123/);
	assert.match(out.text, /Ask about the gate/);
	assert.match(out.report, /standalone \.skipgossipid -> talk/);
});

test("dialogue beside a real goal adds no completion gate", () => {
	const out = convert(".target Example Keeper::201\n.xp 2\n.skipgossipid 8123");
	assert.match(out.text, /talk 201 gossip 8123 optional/);
});

for (const [name, body] of [
	["along collection", "#completewith next\n.collect 10,1"],
	["quest accepted elsewhere", ".turnin 1"],
	["holder for another class", ".xp 2 << Warrior"],
	["arrival emitted later", ".zone Example Destination"],
]) test(`synthetic dialogue does not change gates for ${name}`, () => {
	const condition = name === "holder for another class" ? " << Mage" : "";
	const baseline = convert(body);
	const out = convert(`${body}\n.target Example Keeper::201${condition}\n.skipgossipid 8123${condition}`);
	assert.equal(out.text, baseline.text);
	assert.match(out.report, /unsupported \.skipgossipid/);
});

test("a unique exact name can identify the target", () => {
	assert.match(convert(".target Example Keeper\n.skipgossipid 8123").text, /talk 201 gossip 8123/);
});

test("gossip attaches to a vendor at the exact target", () => {
	const out = convert(".target Example Keeper::201\n.vendor\n.skipgossipid 8123");
	assert.match(out.text, /vendor 201 gossip 8123/);
	assert.doesNotMatch(out.text, /talk 201/);
});

for (const [name, body] of [
	["several option IDs", ".target Example Keeper::201\n.skipgossipid 8123,8124"],
	["unknown NPC", ".target Unknown::999\n.skipgossipid 8123"],
	["parent prefix", ".target Example Keeper::201\n.skipgossipid +8123"],
	["sequence", ".target Example Keeper::201\n.skipgossipid 8123\n.skipgossipid 8124"],
	["mixed dialogue sequence", ".target Example Keeper::201\n.skipgossipid 8123\n.skipgossip 1"],
	["conditional target broader than dialogue", ".target Example Keeper::201 << Mage\n.skipgossipid 8123"],
	["unknown condition", ".target Example Keeper::201\n.skipgossipid 8123 << InventedCondition"],
	["unknown explicit ID with a known name", ".target Example Keeper::999\n.skipgossipid 8123"],
	["ambiguous target", ".target Example Keeper::201\n.target Unknown::999\n.skipgossipid 8123"],
]) test(`${name} is reported without guessed automation`, () => {
	const out = convert(body);
	assert.doesNotMatch(out.text, /gossip \d+/);
	assert.match(out.report, /unsupported \.skipgossipid/);
});

test("represented ordinary commands do not report lost explanatory text", () => {
	assert.doesNotMatch(convert(".target Example Keeper::201\n.vendor >>Sell your spare supplies").report, /lost explanatory text/);
});

test("conditional dialogue stays restricted to the matching class", () => {
	const out = convert(".target Example Keeper::201 << Mage\n.skipgossipid 8123 << Mage");
	assert.match(out.text, /talk 201 gossip 8123 only Mage/);
});

test("lost ignored and unknown command text is reported with source context", () => {
	for (const cmd of ["macro", "inventedcommand"]) {
		const out = convert(`.${cmd} 1 >>Keep this explanatory sentence`);
		assert.match(out.report, /lost explanatory text/);
		assert.match(out.report, /Keep this explanatory sentence/);
		assert.match(out.report, /1-2 Example Zone/);
		assert.match(out.report, /"stepNo":1/);
	}
});
