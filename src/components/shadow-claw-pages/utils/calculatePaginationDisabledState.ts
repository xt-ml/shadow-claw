/**
 * Calculates whether previous and next navigation buttons should be disabled based on current page index.
 */
export function calculatePaginationDisabledState(
  selectedIndex: number,
  totalPages: number,
): { isPrevDisabled: boolean; isNextDisabled: boolean } {
  if (totalPages === 0) {
    return { isPrevDisabled: true, isNextDisabled: true };
  }

  const isPrevDisabled = selectedIndex <= 0;
  const isNextDisabled = selectedIndex < 0 || selectedIndex >= totalPages - 1;

  return { isPrevDisabled, isNextDisabled };
}
