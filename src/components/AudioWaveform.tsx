import React, { useEffect, useState } from 'react';

const NAVY = '#001F3F';
const SAFETY_RED = '#FF4136';

interface AudioWaveformProps {
  active: boolean;
  color?: 'navy' | 'red';
  barCount?: number;
}

export default function AudioWaveform({ active, color = 'navy', barCount = 5 }: AudioWaveformProps) {
  const [heights, setHeights] = useState<number[]>(() => Array(barCount).fill(0.3));

  useEffect(() => {
    if (!active) {
      setHeights(Array(barCount).fill(0.3));
      return;
    }
    const id = setInterval(() => {
      setHeights(Array.from({ length: barCount }, () => 0.2 + Math.random() * 0.8));
    }, 120);
    return () => clearInterval(id);
  }, [active, barCount]);

  const fillColor = color === 'red' ? SAFETY_RED : NAVY;

  return (
    <div className="flex items-center gap-0.5 h-6" aria-hidden>
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-full transition-all duration-100"
          style={{
            height: active ? `${h * 100}%` : '30%',
            minHeight: 4,
            backgroundColor: fillColor,
          }}
        />
      ))}
    </div>
  );
}
