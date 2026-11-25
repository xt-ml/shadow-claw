import { openDatabase } from "../db/open-database.js";
import { createGroupDirectory } from "../storage/create-group-directory.js";
import { groupFileExists } from "../storage/group-file-exists.js";
import { listGroupFiles } from "../storage/list-group-files.js";
import { readGroupFile } from "../storage/read-group-file.js";
import { readGroupFileBytes } from "../storage/read-group-file-bytes.js";
import { writeGroupFile } from "../storage/write-group-file.js";
import { createFileSystem } from "./fs.js";
import { executeShell } from "./shell.js";
import type { ShadowClawDatabase } from "../db/types.js";

function uniqueGroupId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe("just-bash integration", () => {
  let db: ShadowClawDatabase;

  beforeAll(async () => {
    db = await openDatabase();
  });

  describe("workspace persistence and DefenseInDepthBox compatibility", () => {
    it("persists stdout/append redirections, reads UTF-8 and binary workspace files, and skips /dev/null and /tmp", async () => {
      const groupId = uniqueGroupId("shell-io");
      await writeGroupFile(db, groupId, "utf8.txt", "你好世界");
      const rawBinary = Uint8Array.from([0x00, 0xff, 0x78, 0xef]);
      await writeGroupFile(db, groupId, "raw.bin", rawBinary);

      const writeRes = await executeShell(
        db,
        'echo "hello" > /home/user/out.txt && echo "rel" > rel.txt && echo "line2" >> /home/user/out.txt && echo "discard" > /dev/null && echo "tmp" > /tmp/scratch.txt && cat /home/user/utf8.txt',
        groupId,
      );

      expect(writeRes.exitCode).toBe(0);
      expect(writeRes.stderr).toBe("");
      expect(writeRes.stdout).toBe("你好世界");
      expect(await readGroupFile(db, groupId, "out.txt")).toBe(
        "hello\nline2\n",
      );
      expect(await readGroupFile(db, groupId, "rel.txt")).toBe("rel\n");
      expect(await groupFileExists(db, groupId, "scratch.txt")).toBe(false);

      const cpBinRes = await executeShell(
        db,
        "cp /home/user/raw.bin /home/user/raw-copy.bin",
        groupId,
      );
      expect(cpBinRes.exitCode).toBe(0);
      expect(await readGroupFileBytes(db, groupId, "raw-copy.bin")).toEqual(
        rawBinary,
      );
    });
  });

  describe("directory and file lifecycle", () => {
    it("persists mkdir -p, cp -r, directory mv, file mv into existing dir, hard links, and rm -rf", async () => {
      const groupId = uniqueGroupId("shell-lifecycle");

      const setupRes = await executeShell(
        db,
        [
          "mkdir -p nested/dir",
          'echo "payload" > nested/dir/item.txt',
          "cp -r nested copy_dir",
          "mv copy_dir renamed_dir",
        ].join(" && "),
        groupId,
      );
      expect(setupRes.exitCode).toBe(0);
      expect(setupRes.stderr).toBe("");

      const rootEntriesAfterMv = await listGroupFiles(db, groupId, ".");
      expect(rootEntriesAfterMv).toContain("nested/");
      expect(rootEntriesAfterMv).toContain("renamed_dir/");
      expect(rootEntriesAfterMv).not.toContain("copy_dir/");
      expect(await readGroupFile(db, groupId, "renamed_dir/dir/item.txt")).toBe(
        "payload\n",
      );

      await createGroupDirectory(db, groupId, "existing_dir");
      await writeGroupFile(db, groupId, "a.txt", "alpha");
      await writeGroupFile(db, groupId, "b.txt", "beta");

      const mvFileRes = await executeShell(
        db,
        "mv b.txt existing_dir/ && ln a.txt hardlink.txt",
        groupId,
      );
      expect(mvFileRes.exitCode).toBe(0);
      expect(mvFileRes.stderr).toBe("");
      expect(await readGroupFile(db, groupId, "existing_dir/b.txt")).toBe(
        "beta",
      );
      expect(await groupFileExists(db, groupId, "b.txt")).toBe(false);
      expect(await readGroupFile(db, groupId, "hardlink.txt")).toBe("alpha");

      const fs = await createFileSystem(db, groupId);
      await fs.mv("/home/user/a.txt", "/home/user/existing_dir");
      expect(await readGroupFile(db, groupId, "existing_dir/a.txt")).toBe(
        "alpha",
      );
      expect(await groupFileExists(db, groupId, "a.txt")).toBe(false);

      const rmRes = await executeShell(db, "rm -rf renamed_dir", groupId);
      expect(rmRes.exitCode).toBe(0);
      const rootEntriesAfterRm = await listGroupFiles(db, groupId, ".");
      expect(rootEntriesAfterRm).not.toContain("renamed_dir/");
    });
  });

  describe("atomic createExclusive", () => {
    it("creates files and directories atomically, rejects duplicates with EEXIST, and persists to storage", async () => {
      const groupId = uniqueGroupId("shell-exclusive");
      const fs = await createFileSystem(db, groupId);
      fs.mkdirSync("/home/user", { recursive: true });

      await (fs as any).createExclusive("/home/user/atomic.txt", {
        mode: 0o600,
      });
      await (fs as any).createExclusive("/home/user/atomic-dir", {
        mode: 0o700,
        directory: true,
      });

      await expect(
        (fs as any).createExclusive("/home/user/atomic.txt", { mode: 0o600 }),
      ).rejects.toThrow(/EEXIST/);

      expect(await groupFileExists(db, groupId, "atomic.txt")).toBe(true);
      expect(await listGroupFiles(db, groupId, ".")).toContain("atomic-dir/");
    });

    it("persists files and directories created via mktemp and discards /dev/null redirects", async () => {
      const groupId = uniqueGroupId("shell-mktemp");

      const fileRes = await executeShell(
        db,
        'tmpfile=$(mktemp -p /home/user) && echo "temp-data" > "$tmpfile" && echo "discard" > /dev/null && basename "$tmpfile"',
        groupId,
      );
      expect(fileRes.exitCode).toBe(0);
      expect(fileRes.stderr).toBe("");
      const createdFile = fileRes.stdout.trim();
      expect(createdFile).toMatch(/^tmp\./);
      expect(await readGroupFile(db, groupId, createdFile)).toBe("temp-data\n");

      const dirRes = await executeShell(
        db,
        'tmpdir=$(mktemp -d -p /home/user) && scratch=$(mktemp) && echo "ephemeral" > "$scratch" && basename "$tmpdir"',
        groupId,
      );
      expect(dirRes.exitCode).toBe(0);
      expect(dirRes.stderr).toBe("");
      const createdDir = dirRes.stdout.trim();
      expect(createdDir).toMatch(/^tmp\./);
      const entries = await listGroupFiles(db, groupId, ".");
      expect(entries).toContain(`${createdDir}/`);
      expect(entries).toEqual([createdFile, `${createdDir}/`].sort());
    });
  });

  describe("pipes, heredocs, errors, and timeout cancellation", () => {
    it("executes multi-stage pipelines and heredocs and returns non-zero exit codes on errors", async () => {
      const groupId = uniqueGroupId("shell-pipes");

      const pipeRes = await executeShell(
        db,
        [
          "cat <<'EOF' > lines.txt",
          "alpha",
          "beta match",
          "gamma match",
          "EOF",
          "cat lines.txt | grep match | wc -l",
        ].join("\n"),
        groupId,
      );
      expect(pipeRes.exitCode).toBe(0);
      expect(pipeRes.stdout.trim()).toBe("2");

      const errRes = await executeShell(db, "cat missing-file.txt", groupId);
      expect(errRes.exitCode).not.toBe(0);
      expect(errRes.stderr).toContain("No such file or directory");
    });

    it("cancels runaway loops when timeoutSec expires", async () => {
      const groupId = uniqueGroupId("shell-timeout");

      const res = await executeShell(
        db,
        "while true; do :; done",
        groupId,
        {},
        0.05,
      );
      expect(res.exitCode).not.toBe(0);
    });
  });

  describe("network access control", () => {
    it("blocks curl when allowFullInternetAccess is false", async () => {
      const groupId = uniqueGroupId("shell-net");

      const res = await executeShell(
        db,
        "curl https://example.com",
        groupId,
        {},
        10,
        false,
      );
      expect(res.exitCode).not.toBe(0);
      expect(res.stderr).toMatch(/network|denied|access/i);
    });
  });
});
