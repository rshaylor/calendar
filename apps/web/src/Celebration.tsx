import { useEffect, useState } from "react";

const PARTY_EMOJIS = ["🎉", "⭐", "✨", "🌟", "🎊", "💫", "🥳", "🦄"];

type Burst = { id: number; emoji: string; left: number; delay: number; duration: number };

export default function Celebration({
  trigger,
  message,
}: {
  trigger: number;
  message?: string;
}) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    const items: Burst[] = Array.from({ length: 24 }, (_, i) => ({
      id: trigger * 100 + i,
      emoji: PARTY_EMOJIS[Math.floor(Math.random() * PARTY_EMOJIS.length)],
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      duration: 1.6 + Math.random() * 1.2,
    }));
    setBursts(items);
    setShow(true);
    const t = setTimeout(() => setShow(false), 2800);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!show) return null;

  return (
    <>
      <style>{`
        @keyframes celebrate-rise {
          0%   { transform: translateY(20vh) scale(0.6); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translateY(-90vh) scale(1.2) rotate(20deg); opacity: 0; }
        }
        @keyframes celebrate-message {
          0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          20%  { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
          80%  { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          zIndex: 9999,
        }}
      >
        {bursts.map((b) => (
          <span
            key={b.id}
            style={{
              position: "absolute",
              left: `${b.left}%`,
              bottom: 0,
              fontSize: 38,
              animation: `celebrate-rise ${b.duration}s ease-out ${b.delay}s forwards`,
            }}
          >
            {b.emoji}
          </span>
        ))}
        {message && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: 48,
              fontWeight: 700,
              color: "white",
              textShadow: "0 4px 20px rgba(0,0,0,0.6)",
              animation: "celebrate-message 2.5s ease-out forwards",
            }}
          >
            {message}
          </div>
        )}
      </div>
    </>
  );
}
