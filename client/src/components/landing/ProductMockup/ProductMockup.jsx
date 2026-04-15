import React, { useState, useEffect } from 'react';
import styles from './ProductMockup.module.css';

export function ProductMockup() {
  const [activeTab, setActiveTab] = useState('gap');

  return (
    <div className={styles.mockupContainer}>
      <div className={styles.windowHeader}>
        <div className={styles.dots}>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
        <div className={styles.title}>CREATRBASE DASHBOARD</div>
      </div>
      
      <div className={styles.windowContent}>
        <aside className={styles.sidebar}>
          <div className={`${styles.navItem} ${activeTab === 'gap' ? styles.active : ''}`} onClick={() => setActiveTab('gap')}>Gap Tracker</div>
          <div className={`${styles.navItem} ${activeTab === 'reach' ? styles.active : ''}`} onClick={() => setActiveTab('reach')}>Outreach</div>
          <div className={`${styles.navItem} ${activeTab === 'negotiate' ? styles.active : ''}`} onClick={() => setActiveTab('negotiate')}>Negotiate</div>
        </aside>
        
        <main className={styles.main}>
          {activeTab === 'gap' && (
            <div className={styles.view}>
              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <label>Commercial Viability</label>
                  <div className={styles.value}>84%</div>
                  <div className={styles.trend}>+12% spike</div>
                </div>
                <div className={styles.statCard}>
                  <label>Earnings Ceiling</label>
                  <div className={styles.value}>$1.2k/mo</div>
                  <div className={styles.trend}>Fashion Niche</div>
                </div>
              </div>
              <div className={styles.chartPlaceholder}>
                <div className={styles.bar} style={{ height: '60%' }} />
                <div className={styles.bar} style={{ height: '40%' }} />
                <div className={styles.bar} style={{ height: '80%' }} />
                <div className={styles.bar} style={{ height: '95%' }} />
                <div className={styles.bar} style={{ height: '70%' }} />
              </div>
            </div>
          )}
          {/* Default other tabs for speed */}
          {activeTab !== 'gap' && (
            <div className={styles.emptyView}>
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLine} />
              <div className={styles.skeletonLine} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
