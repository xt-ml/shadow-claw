export function normalizePrerenderPagesOption(val) {
  if (val === undefined || val === null || val === "" || val === true) {
    return 1;
  }
  const str = String(val).trim().toLowerCase();
  if (str === "all") {
    return "all";
  }
  if (str === "none" || str === "0" || str === "false") {
    return 0;
  }
  if (str === "1" || str === "current" || str === "single") {
    return 1;
  }
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 0) {
    return num;
  }
  return 1;
}
