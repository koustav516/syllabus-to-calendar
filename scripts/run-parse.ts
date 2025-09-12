// scripts/run-parse.ts
import fs from "fs/promises";
import path from "path";
import { parseSyllabusText } from "../src/lib/parseSyllabus";

async function main() {
    const file = path.resolve("examples/example-syllabus.txt");
    const txt = await fs.readFile(file, "utf8");
    const events = parseSyllabusText(txt, new Date().getFullYear());
    console.log("Parsed events:", JSON.stringify(events, null, 2));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
