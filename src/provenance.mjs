// A portable, deliberately allowlisted build record. No filesystem, guide text,
// source paths, personal pack metadata, or whole manifest is copied into it.
import { SOURCES, ROUTES } from "./core.mjs";

export function buildProvenance({ runs, manifest, opts = {}, locales = [], converterRevision = null }) {
	if (converterRevision != null && !/^[0-9a-f]{7,64}$/i.test(converterRevision)) throw new Error("converter revision must be a Git commit hash (7–64 hexadecimal characters)");
	const scalar = (v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : null;
	const commit = scalar(manifest.polestar?.commit);
	return {
		schemaVersion: 1,
		converter: {
			name: "polestar-convert", upstreamVersion: "0.2.0",
			revision: converterRevision,
			revisionStatus: converterRevision ? "caller-supplied; working tree and binary contents not verified" : "unavailable; source revision not embedded",
		},
		sourceAddons: Object.fromEntries(SOURCES.filter((s) => runs[s]).map((s) => [s, { version: scalar(runs[s].version) }])),
		gameDataManifest: {
			polestarCommit: commit, builtAt: scalar(manifest.builtAt),
			foreverBuild: scalar(manifest.foreverBuild), build: scalar(manifest.build),
			iface: scalar(manifest.iface), questie: scalar(manifest.questie),
		},
		compiler: {
			name: "polestar_convert_wasm", manifestPolestarCommit: commit,
			binaryDigest: null, identityStatus: "manifest attribution only; compiler binary digest unavailable",
		},
		options: {
			sources: SOURCES.filter((s) => !opts.sources?.length || opts.sources.includes(s)),
			routes: !opts.routes?.length ? [...ROUTES] : ROUTES.filter((r) => opts.routes.includes(r)),
			selfFound: !!opts.selfFound, ah: opts.ah !== "no",
			groups: opts.groups ? opts.groups !== "no" : "asked per quest",
			locales: [...locales],
		},
	};
}
