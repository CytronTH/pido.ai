import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function SystemClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 bg-surface/50 border border-line px-3 py-1.5 rounded-lg text-sm font-medium shadow-inner hidden sm:flex text-fg-muted">
      <Clock size={16} className="text-teal-500" />
      <span>{time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
    </div>
  );
}
