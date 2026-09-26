/** 首頁問候(PRD FR-4.1):依時段早安 / 午安 / 晚安,日期含星期 */
export function greetingOf(hour: number): string {
  if (hour >= 5 && hour < 11) return '早安';
  if (hour >= 11 && hour < 18) return '午安';
  return '晚安';
}

export function dateLabel(d: Date): string {
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}
