import React, { useEffect, useState } from "react";
import { photoUrl } from "@/lib/api";
import { initials } from "@/lib/format";

const hue = (s = "") => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};

export const UserPhoto = ({ src, name = "", className = "", alt, style, ...rest }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const url = photoUrl(src);
  if (!url || failed) {
    const h = hue(name);
    return (
      <div
        className={`flex items-center justify-center overflow-hidden font-display font-bold text-ink ${className}`}
        style={{ background: `hsl(${h} 70% 90%)`, color: `hsl(${h} 45% 30%)`, ...style }}
        aria-label={alt || name}
        {...rest}
      >
        <span className="text-[0.9em]">{initials(name) || "?"}</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt || name}
      className={`object-cover ${className}`}
      style={style}
      onError={() => setFailed(true)}
      draggable={false}
      {...rest}
    />
  );
};
