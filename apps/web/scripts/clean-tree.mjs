/**
 * Session 27: `pnpm deploy:preview` builds only from a commit. The lobby's version label names the commit the build was
 * made from, so a build made before its changes were committed showed the previous commit (session 26's labels lagged
 * one behind). This stops the deploy if anything is uncommitted: commit first, then deploy, and the label is the build
 * that's live.
 */
import { execSync } from "node:child_process";

const dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim();
if (dirty) {
  console.log("Uncommitted changes. Commit them first, so the lobby's version label names the build that goes live:\n");
  console.log(dirty);
  process.exit(1);
}
const commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
console.log(`Building and deploying commit ${commit}.`);
