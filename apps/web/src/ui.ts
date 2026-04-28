export const PRESET_COLORS = ["#f59ec1", "#fbbf6f", "#9bd49b", "#86b9f7", "#c8a4ee", "#f59c9c"];
export const PRESET_AVATARS = ["🦊", "🐻", "🐼", "🦁", "🐸", "🐙", "🐳", "🦄"];
export const PRESET_CHORE_EMOJIS = ["🧹", "🍽️", "🛏️", "🪥", "🧺", "🚮", "📚", "🐾", "🚿", "✅"];
export const PRESET_REWARD_EMOJIS = ["🎁", "🍦", "🎬", "🎮", "🍕", "🏊", "🎨", "💰", "📱", "🧸"];

export function tint(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
