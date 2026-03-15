import { awkCommand } from "./awk.mjs";
import { base64Command } from "./base64.mjs";
import { basenameCommand } from "./basename.mjs";
import { bracketCommand } from "./bracket.mjs";
import { catCommand } from "./cat.mjs";
import { cdCommand } from "./cd.mjs";
import { commandCommand } from "./command.mjs";
import { cpCommand } from "./cp.mjs";
import { cutCommand } from "./cut.mjs";
import { dateCommand } from "./date.mjs";
import { diffCommand } from "./diff.mjs";
import { dirnameCommand } from "./dirname.mjs";
import { duCommand } from "./du.mjs";
import { echoCommand } from "./echo.mjs";
import { envCommand } from "./env.mjs";
import { exportCommand } from "./export.mjs";
import { falseCommand } from "./false.mjs";
import { findCommand } from "./find.mjs";
import { readlinkCommand } from "./readlink.mjs";
import { realpathCommand } from "./realpath.mjs";
import { grepCommand } from "./grep.mjs";
import { headCommand } from "./head.mjs";
import { jqCommand } from "./jq.mjs";
import { lsCommand } from "./ls.mjs";
import { md5sumCommand } from "./md5sum.mjs";
import { mkdirCommand } from "./mkdir.mjs";
import { mvCommand } from "./mv.mjs";
import { printenvCommand } from "./printenv.mjs";
import { printfCommand } from "./printf.mjs";
import { pwdCommand } from "./pwd.mjs";
import { revCommand } from "./rev.mjs";
import { tarCommand } from "./tar.mjs";
import { rmCommand } from "./rm.mjs";
import { sedCommand } from "./sed.mjs";
import { seqCommand } from "./seq.mjs";
import { sha1sumCommand } from "./sha1sum.mjs";
import { sha256sumCommand } from "./sha256sum.mjs";
import { sha384sumCommand } from "./sha384sum.mjs";
import { sha512sumCommand } from "./sha512sum.mjs";
import { sleepCommand } from "./sleep.mjs";
import { sortCommand } from "./sort.mjs";
import { tailCommand } from "./tail.mjs";
import { teeCommand } from "./tee.mjs";
import { testCommand } from "./shellTestCommand.mjs";
import { touchCommand } from "./touch.mjs";
import { trCommand } from "./tr.mjs";
import { trueCommand } from "./true.mjs";
import { uniqCommand } from "./uniq.mjs";
import { wcCommand } from "./wc.mjs";
import { whichCommand } from "./which.mjs";
import { xargsCommand } from "./xargs.mjs";
import { yesCommand } from "./yes.mjs";

/** @typedef {import("./types.mjs").ShellCommandHandler} ShellCommandHandler */

/** @type {Record<string, ShellCommandHandler>} */
export const COMMAND_HANDLERS = {
  awk: awkCommand,
  base64: base64Command,
  basename: basenameCommand,
  "[": bracketCommand,
  cat: catCommand,
  cd: cdCommand,
  command: commandCommand,
  cp: cpCommand,
  cut: cutCommand,
  date: dateCommand,
  diff: diffCommand,
  dirname: dirnameCommand,
  du: duCommand,
  echo: echoCommand,
  env: envCommand,
  export: exportCommand,
  false: falseCommand,
  find: findCommand,
  grep: grepCommand,
  readlink: readlinkCommand,
  realpath: realpathCommand,
  head: headCommand,
  jq: jqCommand,
  ls: lsCommand,
  md5sum: md5sumCommand,
  mkdir: mkdirCommand,
  mv: mvCommand,
  printenv: printenvCommand,
  printf: printfCommand,
  pwd: pwdCommand,
  rev: revCommand,
  rm: rmCommand,
  tar: tarCommand,
  sed: sedCommand,
  seq: seqCommand,
  sha1sum: sha1sumCommand,
  sha256sum: sha256sumCommand,
  sha384sum: sha384sumCommand,
  sha512sum: sha512sumCommand,
  sleep: sleepCommand,
  sort: sortCommand,
  tail: tailCommand,
  tee: teeCommand,
  test: testCommand,
  touch: touchCommand,
  tr: trCommand,
  true: trueCommand,
  uniq: uniqCommand,
  wc: wcCommand,
  which: whichCommand,
  xargs: xargsCommand,
  yes: yesCommand,
};
