import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import YAML from "yaml";

const args = process.argv.slice(2);

const readArg = (name, fallback) => {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
};

const profile = readArg("profile", "internal");
const inputPath = readArg(
  "input",
  "docs/reference/openapi.smartout.v1.yaml",
);
const outputPath = readArg(
  "output",
  `docs/reference/openapi.smartout.${profile}.yaml`,
);
const manifestPath = readArg(
  "manifest",
  "docs/reference/api-visibility.profiles.json",
);

const cwd = process.cwd();
const absInput = path.resolve(cwd, inputPath);
const absOutput = path.resolve(cwd, outputPath);
const absManifest = path.resolve(cwd, manifestPath);

const specRaw = fs.readFileSync(absInput, "utf8");
const manifestRaw = fs.readFileSync(absManifest, "utf8");

const spec = YAML.parse(specRaw);
const manifest = JSON.parse(manifestRaw);

const profileConfig = manifest.profiles?.[profile];
if (!profileConfig) {
  throw new Error(
    `Unknown profile "${profile}". Available: ${Object.keys(
      manifest.profiles ?? {},
    ).join(", ")}`,
  );
}

const visibilityAllowed = new Set(profileConfig.allowVisibility ?? ["internal"]);
const includePlanned = Boolean(profileConfig.includePlanned);
const operationOverrides = manifest.operations ?? {};

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
]);

const cloned = structuredClone(spec);
const prunedPaths = {};

for (const [pathKey, pathItem] of Object.entries(cloned.paths ?? {})) {
  const nextPathItem = {};

  for (const [key, value] of Object.entries(pathItem)) {
    if (!HTTP_METHODS.has(key)) {
      nextPathItem[key] = value;
      continue;
    }

    const operation = value;
    const operationId = operation.operationId ?? `${key}:${pathKey}`;
    const override = operationOverrides[operationId] ?? {};
    const visibility = override.visibility ?? operation["x-doc-visibility"] ?? "internal";
    const roadmapStatus = operation["x-roadmap-status"] ?? "implemented";

    const profileEnabledMap = override.enabled ?? {};
    if (profileEnabledMap[profile] === false) {
      continue;
    }

    if (!visibilityAllowed.has(visibility)) {
      continue;
    }

    if (!includePlanned && roadmapStatus === "planned") {
      continue;
    }

    nextPathItem[key] = operation;
  }

  if (Object.keys(nextPathItem).some((k) => HTTP_METHODS.has(k))) {
    prunedPaths[pathKey] = nextPathItem;
  }
}

cloned.paths = prunedPaths;
cloned.info = {
  ...(cloned.info ?? {}),
  title: `${cloned.info?.title ?? "Smartout API"} (${profile})`,
  version: `${cloned.info?.version ?? "0.1.0"}-${profile}`,
};
cloned["x-generated-profile"] = profile;

fs.mkdirSync(path.dirname(absOutput), { recursive: true });
fs.writeFileSync(absOutput, YAML.stringify(cloned), "utf8");

console.log(
  `Generated ${outputPath} with ${Object.keys(prunedPaths).length} visible path(s) for profile "${profile}".`,
);

