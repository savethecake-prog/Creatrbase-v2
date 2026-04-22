import { Component } from 'react';
import styles from './ErrorBoundary.module.css';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className={styles.wrap}>
        <div className={styles.card}>
          <p className={styles.icon}>⚠</p>
          <h2 className={styles.title}>Something went wrong</h2>
          <p className={styles.desc}>An unexpected error occurred. Refreshing the page usually fixes it.</p>
          <div className={styles.actions}>
            <button className={styles.retryBtn} onClick={() => this.handleReset()}>Try again</button>
            <button className={styles.reloadBtn} onClick={() => window.location.reload()}>Reload page</button>
          </div>
        </div>
      </div>
    );
  }
}
