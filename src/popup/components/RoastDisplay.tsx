interface RoastDisplayProps {
  roast: string;
  categories: string[];
  timestamp: number;
}

/** Displays the current roast, the detected categories and the scan time. */
export function RoastDisplay({ roast, categories, timestamp }: RoastDisplayProps) {
  const time = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="roast">
      <p className="roast__text">{roast}</p>
      {categories.length > 0 && (
        <ul className="roast__tags">
          {categories.map((category) => (
            <li key={category} className="roast__tag">
              {category}
            </li>
          ))}
        </ul>
      )}
      <p className="roast__time">Last scan: {time}</p>
    </div>
  );
}
