'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Label printed alongside the error in the console — helps spot which
      section blew up when triaging a Vercel log. */
  label?: string;
}

interface State { hasError: boolean }

// Scoped error boundary intended to wrap a single <Suspense> below a server
// page so that a thrown render (e.g. an upstream Supabase JS error that
// escapes the cache fallback) degrades JUST that section instead of
// replacing the whole page via the route-level error.tsx.
export default class SectionErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`[SectionErrorBoundary${this.props.label ? ` — ${this.props.label}` : ''}]`, error);
  }

  render() {
    if (this.state.hasError) return <>{this.props.fallback ?? null}</>;
    return <>{this.props.children}</>;
  }
}
