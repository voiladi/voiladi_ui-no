import { useCallback, useEffect, useRef, useState } from "react";

/* Briefly flips a boolean on (e.g. to turn a counter red when a limit is hit) - inline feedback, no popup. */
export const useFlash = (ms = 1200) => {
  const [on, setOn] = useState(false);
  const t = useRef(null);
  const flash = useCallback(() => {
    clearTimeout(t.current);
    setOn(true);
    t.current = setTimeout(() => setOn(false), ms);
  }, [ms]);
  useEffect(() => () => clearTimeout(t.current), []);
  return [on, flash];
};
