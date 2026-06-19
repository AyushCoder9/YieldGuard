"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { clsx } from "clsx";

interface TooltipProps {
  content: React.ReactNode;
  children?: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const open = () => {
    clearTimeout(timerRef.current);
    setShow(true);
  };
  const close = () => {
    timerRef.current = setTimeout(() => setShow(false), 80);
  };

  const positionClass = {
    top:    "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left:   "right-full top-1/2 -translate-y-1/2 mr-2",
    right:  "left-full top-1/2 -translate-y-1/2 ml-2",
  }[side];

  return (
    <span
      className={clsx("relative inline-flex items-center", className)}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
    >
      {children ?? (
        <span className="cursor-help text-cc-subtle hover:text-cc-muted transition-colors">
          <HelpCircle size={13} />
        </span>
      )}
      <AnimatePresence>
        {show && (
          <motion.div
            role="tooltip"
            className={clsx(
              "absolute z-50 w-max max-w-[220px] glass rounded-lg px-3 py-2 text-xs text-cc-muted leading-relaxed shadow-xl pointer-events-none",
              positionClass
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12 }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
