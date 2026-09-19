import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

async function main() {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  const testResultsDir = path.resolve("test-results");
  const resultsJsonPath = path.join(testResultsDir, "results.json");

  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const runId = process.env.GITHUB_RUN_ID || "local";
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT || "1";
  const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";

  let results = null;
  if (fs.existsSync(resultsJsonPath)) {
    try {
      results = JSON.parse(fs.readFileSync(resultsJsonPath, "utf-8"));
    } catch (e) {
      console.warn("Could not parse results.json:", e);
    }
  }

  // Find all screenshot png files
  const screenshots = [];
  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".png")) {
        screenshots.push(fullPath);
      }
    }
  }
  scanDir(testResultsDir);

  // Map of local file path -> public URL
  const screenshotUrls = new Map();

  // If running in GitHub Actions with token and repo, try publishing failure screenshots to ci-screenshots branch
  if (screenshots.length > 0 && token && repo) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ci-screenshots-"));
    try {
      console.log(`Found ${screenshots.length} screenshot(s). Attempting to publish to ci-screenshots branch...`);
      const remoteUrl = `https://x-access-token:${token}@github.com/${repo}.git`;

      let branchExists = false;
      try {
        execSync(`git ls-remote --exit-code --heads "${remoteUrl}" ci-screenshots`, { stdio: "pipe" });
        branchExists = true;
      } catch {
        branchExists = false;
      }

      if (branchExists) {
        execSync(`git clone --depth 1 --branch ci-screenshots "${remoteUrl}" "${tempDir}"`, { stdio: "pipe" });
      } else {
        execSync(`git clone --depth 1 "${remoteUrl}" "${tempDir}"`, { stdio: "pipe" });
        execSync(`git checkout --orphan ci-screenshots`, { cwd: tempDir, stdio: "pipe" });
        execSync(`git rm -rf .`, { cwd: tempDir, stdio: "pipe" });
      }

      const destinationDir = path.join(tempDir, "runs", `${runId}-${runAttempt}`);
      fs.mkdirSync(destinationDir, { recursive: true });

      for (const src of screenshots) {
        const relativeFolder = path.basename(path.dirname(src));
        const filename = `${relativeFolder}-${path.basename(src)}`;
        const dest = path.join(destinationDir, filename);
        fs.copyFileSync(src, dest);

        const rawUrl = `https://raw.githubusercontent.com/${repo}/ci-screenshots/runs/${runId}-${runAttempt}/${filename}`;
        screenshotUrls.set(src, rawUrl);
        // Also map just the filename in case we look up by basename
        screenshotUrls.set(path.basename(src), rawUrl);
      }

      // Prune old runs (keep last 10 runs)
      const runsBaseDir = path.join(tempDir, "runs");
      if (fs.existsSync(runsBaseDir)) {
        const runDirs = fs.readdirSync(runsBaseDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => ({
            name: d.name,
            mtime: fs.statSync(path.join(runsBaseDir, d.name)).mtimeMs,
          }))
          .sort((a, b) => b.mtime - a.mtime);

        for (let i = 10; i < runDirs.length; i++) {
          fs.rmSync(path.join(runsBaseDir, runDirs[i].name), { recursive: true, force: true });
        }
      }

      execSync(`git config user.name "github-actions[bot]"`, { cwd: tempDir, stdio: "pipe" });
      execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`, { cwd: tempDir, stdio: "pipe" });
      execSync(`git add -A`, { cwd: tempDir, stdio: "pipe" });

      const status = execSync(`git status --porcelain`, { cwd: tempDir, encoding: "utf-8" }).trim();
      if (status) {
        execSync(`git commit -m "Upload failure screenshots for run ${runId} (attempt ${runAttempt})"`, {
          cwd: tempDir,
          stdio: "pipe",
        });
        execSync(`git push origin ci-screenshots`, { cwd: tempDir, stdio: "pipe" });
        console.log("Successfully pushed failure screenshots to ci-screenshots branch.");
      }
    } catch (err) {
      console.warn("Failed to push screenshots to branch (e.g. read-only token on fork):", err.message);
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }

  // Build the markdown summary
  let md = "";
  md += `## 🎭 Playwright E2E Test Results\n\n`;

  const total = results?.stats?.expected ?? 0;
  const unexpected = results?.stats?.unexpected ?? 0;
  const flaky = results?.stats?.flaky ?? 0;
  const skipped = results?.stats?.skipped ?? 0;

  if (unexpected === 0 && screenshots.length === 0) {
    md += `> ✅ **All E2E tests passed successfully!** (${total} passed)\n\n`;
  } else {
    md += `> ❌ **E2E Test Failures Detected** (${unexpected} failed, ${flaky} flaky, ${total} passed)\n\n`;
  }

  // Collect test failure details
  const failedSpecs = [];
  const passedSpecs = [];

  function collectSuites(suiteList) {
    for (const suite of suiteList || []) {
      if (suite.specs) {
        for (const spec of suite.specs) {
          for (const testItem of spec.tests || []) {
            for (const res of testItem.results || []) {
              if (res.status === "failed" || res.status === "timedOut") {
                failedSpecs.push({
                  title: `${suite.title} › ${spec.title}`,
                  file: spec.file,
                  status: res.status,
                  duration: res.duration,
                  errors: res.errors || [],
                  attachments: res.attachments || [],
                });
              } else if (res.status === "passed") {
                passedSpecs.push({
                  title: `${suite.title} › ${spec.title}`,
                  duration: res.duration,
                });
              }
            }
          }
        }
      }
      if (suite.suites) {
        collectSuites(suite.suites);
      }
    }
  }

  if (results?.suites) {
    collectSuites(results.suites);
  }

  // If tests failed, display each with screenshot
  if (failedSpecs.length > 0) {
    md += `### ❌ Failed Tests & Screenshots\n\n`;

    for (const failed of failedSpecs) {
      md += `#### ${failed.title}\n\n`;

      if (failed.errors.length > 0) {
        const errorText = failed.errors
          .map((e) => e.message || e.value || String(e))
          .join("\n\n")
          // Strip ANSI color codes
          .replace(/\u001b\[[0-9;]*m/g, "");

        md += `\`\`\`\n${errorText}\n\`\`\`\n\n`;
      }

      // Check for screenshot attachments
      const screenshotAttachments = failed.attachments.filter(
        (a) => a.contentType?.startsWith("image/") || a.name?.toLowerCase().includes("screenshot")
      );

      let foundScreenshot = false;
      for (const att of screenshotAttachments) {
        const url = screenshotUrls.get(att.path) || screenshotUrls.get(path.basename(att.path || ""));
        if (url) {
          md += `**Failure Screenshot:**\n\n`;
          md += `![Screenshot: ${failed.title}](${url})\n\n`;
          foundScreenshot = true;
        }
      }

      // If no attachment link, but we found screenshots in test-results, check if any match directory
      if (!foundScreenshot && screenshots.length > 0) {
        for (const s of screenshots) {
          const url = screenshotUrls.get(s);
          if (url) {
            md += `**Failure Screenshot:**\n\n`;
            md += `![Screenshot](${url})\n\n`;
            foundScreenshot = true;
            break;
          }
        }
      }

      if (!foundScreenshot && screenshots.length > 0) {
        md += `> ℹ️ *Screenshots were captured and are available in the attached [playwright-report artifact](${serverUrl}/${repo}/actions/runs/${runId}).*\n\n`;
      }

      // Check if error-context.md exists in test-results for this test
      function findErrorContext(dir) {
        if (!fs.existsSync(dir)) return null;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const found = findErrorContext(fullPath);
            if (found) return found;
          } else if (entry.name === "error-context.md") {
            return fullPath;
          }
        }
        return null;
      }

      const errorContextFile = findErrorContext(testResultsDir);
      if (errorContextFile) {
        try {
          const ctxContent = fs.readFileSync(errorContextFile, "utf-8");
          const pageSnapshotMatch = ctxContent.match(/# Page snapshot\s+```yaml([\s\S]*?)```/);
          if (pageSnapshotMatch) {
            md += `<details>\n<summary>🔍 View Page DOM Snapshot</summary>\n\n\`\`\`yaml\n${pageSnapshotMatch[1].trim()}\n\`\`\`\n\n</details>\n\n`;
          }
        } catch {}
      }

      md += `---\n\n`;
    }
  }

  // Summary Table of all tests
  md += `### 📋 Test Overview\n\n`;
  md += `| Result | Test | Duration |\n`;
  md += `| :---: | :--- | :---: |\n`;

  for (const failed of failedSpecs) {
    md += `| ❌ | **${failed.title}** | ${(failed.duration / 1000).toFixed(1)}s |\n`;
  }
  for (const passed of passedSpecs) {
    md += `| ✅ | ${passed.title} | ${(passed.duration / 1000).toFixed(1)}s |\n`;
  }

  md += `\n`;

  console.log("=== Generated Markdown Summary ===\n" + md);

  if (summaryFile) {
    fs.appendFileSync(summaryFile, md, "utf-8");
    console.log(`Summary written to ${summaryFile}`);
  }
}

main().catch((err) => {
  console.error("Error in publish-e2e-summary script:", err);
});
