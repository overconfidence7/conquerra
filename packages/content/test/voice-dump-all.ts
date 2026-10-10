// Lists every string the voice test reaches in files matching an argument (for reading a surface through).
import { collect } from "./voiceScan";
const want = process.argv[2] ?? "";
for (const f of collect()) if (f.file.includes(want) && /[a-z]{2}/i.test(f.text) && f.text.includes(" ")) console.log(`${f.file.replace(/^apps\/web\/src\//, "")} | ${f.text}`);
