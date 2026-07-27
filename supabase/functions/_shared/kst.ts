// KST 기준 오늘 0시를 UTC ISO 문자열로 반환 (프로젝트 날짜 기준은 KST)
export function kstDayStartISO(): string {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = new Date(Date.now() + KST_OFFSET_MS);
  const kstDayStartMs = Date.UTC(
    kstNow.getUTCFullYear(),
    kstNow.getUTCMonth(),
    kstNow.getUTCDate(),
  ) - KST_OFFSET_MS;
  return new Date(kstDayStartMs).toISOString();
}
