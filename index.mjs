#!/usr/bin/env node

import chalk from "chalk";
import { execSync } from "child_process";
import enquirer from "enquirer";
import fs from "fs";

const { Select, Confirm, AutoComplete } = enquirer;

import { packageOptions } from "./packages.js";
import { stacks } from "./stacks.js";

// Parse CLI flags
const isDevInstall = process.argv.includes("--save-dev");
const isDryRun = process.argv.includes("--dry-run");
const showVersion = process.argv.includes("--version");
const showHelp = process.argv.includes("--help");

// Detect package manager
function detectPackageManager() {
    if (fs.existsSync("yarn.lock")) return "yarn";
    if (fs.existsSync("pnpm-lock.yaml")) return "pnpm";
    return "npm";
}
const packageManager = detectPackageManager();

// CLI Info
if (showVersion) {
    console.log("pkg-wizard v1.0.0");
    process.exit(0);
}

if (showHelp) {
    console.log(`
Usage: pkg-wizard [options]

Options:
  --save-dev     Install packages as devDependencies
  --dry-run      Show install command without executing
  --version      Show version info
  --help         Show this help message

Detected package manager: ${packageManager}
`);
    process.exit(0);
}

console.log(chalk.cyan(`\n🧙 Welcome to pkg-wizard (using ${packageManager})\n`));

async function main() {
    try {
        const stackPrompt = new Select({
            name: "stack",
            message: "📦 Choose a project stack or select manually:",
            choices: ["Manual Selection", ...Object.keys(stacks),],
        });

        const selectedStack = await stackPrompt.run();

        if (selectedStack !== "Manual Selection") {
            console.log(chalk.green("\n📚 Packages included in this stack:"));
            stacks[selectedStack].forEach((pkg) =>
                console.log(chalk.yellow("- " + pkg))
            );

            const proceed = await new Confirm({
                name: "confirm",
                message: "Proceed with installing these packages?",
                initial: true,
            }).run();

            if (!proceed) {
                console.log(chalk.red("❌ Installation cancelled."));
                console.log(chalk.blue("🔁 You can run 'pkg-wizard' again anytime.\n"));
                process.exit(0);
            }

            const packages = [...new Set(
                stacks[selectedStack].flatMap(pkg => pkg.split(" ").map(p => p.trim()))
            )];

            installPackages(packages);
            return;
        }

        // Manual selection mode
        let selectedPackages = [];

        while (true) {
            const searchPrompt = new AutoComplete({
                name: "package",
                message: "🔍 Search and select package (or select << Finish selection >>):",
                limit: 10,
                choices: [
                    { name: "<< Finish selection >>", value: "__finish__" },
                    ...packageOptions.map((p) => ({ name: p.value, message: p.name })),
                ],
            });

            const pkg = await searchPrompt.run();

            if (pkg === "__finish__") break;

            if (!selectedPackages.includes(pkg)) {
                selectedPackages.push(pkg);
                console.log(chalk.green(`✅ Added: ${pkg}`));
            } else {
                console.log(chalk.yellow(`⚠️ Package ${pkg} already selected.`));
            }
        }

        if (selectedPackages.length === 0) {
            console.log(chalk.yellow("\n⚠️ No packages selected. Exiting...\n"));
            process.exit(0);
        }

        const proceed = await new Confirm({
            name: "confirm",
            message: `Install these packages?\n${selectedPackages.join(", ")}`,
            initial: true,
        }).run();

        if (!proceed) {
            console.log(chalk.red("❌ Installation cancelled."));
            console.log(chalk.blue("🔁 You can run 'pkg-wizard' again anytime.\n"));
            process.exit(0);
        }

        const finalPackages = [...new Set(
            selectedPackages.flatMap(pkg => pkg.split(" ").map(p => p.trim()))
        )];

        installPackages(finalPackages);
    } catch (error) {
        console.error(chalk.red("\n❌ Wizard failed or was cancelled.\n"), error);
    }
}

// Installer
function installPackages(packages) {
    console.log(chalk.green(`\n📦 Preparing to install as ${isDevInstall ? "devDependencies" : "dependencies"} using ${packageManager}...\n`));

    let installCommand = "";

    switch (packageManager) {
        case "yarn":
            installCommand = `yarn add ${isDevInstall ? "-D" : ""} ${packages.join(" ")}`;
            break;
        case "pnpm":
            installCommand = `pnpm add ${isDevInstall ? "-D" : ""} ${packages.join(" ")}`;
            break;
        default:
            installCommand = `npm install ${isDevInstall ? "--save-dev" : ""} ${packages.join(" ")}`;
    }

    if (isDryRun) {
        console.log(chalk.yellowBright("🧪 Dry Run Mode Enabled!"));
        console.log(chalk.cyan("Install command that would be run:\n"));
        console.log(chalk.bold(installCommand));
        console.log(chalk.blue("\nℹ️ No packages were installed.\n"));
        return;
    }

    execSync(installCommand.trim(), { stdio: "inherit" });
    console.log(chalk.green("\n✅ Installation complete!\n"));
}

main();
