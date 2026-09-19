// Vaste waarden in plaats van random, anders wijkt de server-render af van de client.
const BUBBLES = [
  { left: "6%", size: 13, delay: 0, duration: 15 },
  { left: "14%", size: 8, delay: 5.5, duration: 19 },
  { left: "23%", size: 18, delay: 2.2, duration: 13 },
  { left: "31%", size: 10, delay: 8.4, duration: 17 },
  { left: "42%", size: 15, delay: 1.1, duration: 21 },
  { left: "49%", size: 7, delay: 11.2, duration: 14 },
  { left: "58%", size: 11, delay: 4.3, duration: 18 },
  { left: "66%", size: 20, delay: 7.7, duration: 16 },
  { left: "74%", size: 8, delay: 0.8, duration: 20 },
  { left: "83%", size: 15, delay: 9.6, duration: 15 },
  { left: "91%", size: 10, delay: 3.4, duration: 22 },
  { left: "97%", size: 13, delay: 6.1, duration: 17 },
];

/** Belletjes die langzaam opstijgen. Puur decoratief. */
export function Bubbles({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}
    >
      {BUBBLES.map((bubble, index) => (
        <span
          key={index}
          className="bubble"
          style={{
            left: bubble.left,
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            animationDelay: `${bubble.delay}s`,
            animationDuration: `${bubble.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
