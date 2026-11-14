"use client";
import { Component, type ReactNode } from "react";

/**
 * Minimal error boundary. Catches render/commit errors in its subtree and shows
 * a small inline fallback instead of letting the exception unmount the whole
 * app (Next's default client-error screen). Used around the assistant answer so
 * one bad answer can never white-screen FINN.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Keep it quiet in prod; surface in dev.
    if (process.env.NODE_ENV !== "production") console.error("ErrorBoundary caught", error);
  }

  render() {
    if (this.state.failed) {
      return (
        this.props.fallback ?? (
          <p className="text-[14px] text-down">Something went wrong showing this. Try asking again.</p>
        )
      );
    }
    return this.props.children;
  }
}
