"use strict";

const fs = require("fs-extra");
const path = require("path");
const semver = require("semver");
const polyfillLibrary = require("../../lib/index");
const TOML = require("@iarna/toml");

async function main() {
	const file = path.join(__dirname, "./compat.json");
	// Ensure file exists before proceeding.
	if (!fs.existsSync(file)) {
		throw new Error("Compat results file does not exists, to create the file you need to run the command: `npm run generate-compat-data`.");
	}
	const compat = await fs.readJSON(file);
	const questions = [];
	for (let feature of Object.keys(compat)) {
		feature = feature.split(" ")[0];
		const featureMetadata = await polyfillLibrary.describePolyfill(feature);
		if (!featureMetadata) {
			throw new Error(`${feature} does not exists within the polyfill-library.`);
		}

		for (const browser of Object.keys(compat[feature])) {
			for (const [version, support] of Object.entries(compat[feature][browser])) {
				if (support === "native") {
					if (featureMetadata.browsers && featureMetadata.browsers[browser] && semver.satisfies(semver.coerce(version), featureMetadata.browsers[browser])) {
						questions.push([feature + "|" + browser, JSON.stringify({ [browser]: `<${version}` })]);
					}
				}
				if (support === "polyfilled") {
					if (!featureMetadata.browsers || !featureMetadata.browsers[browser] || !semver.satisfies(semver.coerce(version), featureMetadata.browsers[browser])) {
						questions.push([feature + "|" + browser, JSON.stringify({ [browser]: `<${Number.parseFloat(version) + 1}` })]);
					}
				}

				if (support === "missing") {
					if (!featureMetadata.browsers || !featureMetadata.browsers[browser] || !semver.satisfies(semver.coerce(version), featureMetadata.browsers[browser])) {
						questions.push([feature + "|" + browser,JSON.stringify({ [browser]: `<${Number.parseFloat(version) + 1}` })]);
					}
				}
			}
		}
	}

	async function updateFeature(feature, update) {
		const configPath = path.join(__dirname, "../../polyfills", feature.join("/").replace('.', '/'), "config.toml");
		const config = TOML.parse(await fs.readFile(configPath, 'utf-8'));
		config.browsers = config.browsers || {};
		config.browsers = Object.assign(config.browsers, JSON.parse(update));
        await fs.writeFile(configPath, TOML.stringify(config), 'utf-8');
	}
	if (questions.length > 0) {
		const answers = questions;
		for (const [featureWithBrowser, value] of answers) {
			const [feature] = featureWithBrowser.split("|");
			if (typeof value === "object") {
				for (const [featureWithBrowser2, value2] of Object.entries(value)) {
					const [feature2] = featureWithBrowser2.split("|");
					if (typeof value2 === "object") {
						for (const [featureWithBrowser3, value3] of Object.entries(value2)) {
							const [feature3] = featureWithBrowser3.split("|");
							await updateFeature([feature, feature2, feature3], value3);
						}
					} else {
						await updateFeature([feature, feature2], value2);
					}
				}
			} else {
				await updateFeature([feature], value);
			}
		}
	} else {
		console.log("All browsers have correctly configured polyfills. Nice!");
	}
}

main().catch(e => {
	console.error(e);
	process.exitCode = 1;
});
