import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import styles from './Editorial.module.css';

export function Skills() {
  const [skills, setSkills] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/admin/skills').then(d => {
      setSkills(d.skills || []);
      if (d.skills?.length) setSelected(d.skills[0]);
    }).catch(err => console.error('[Skills]', err));
  }, []);

  return (
    <div>
      <h1 className={styles.title}>Skills</h1>
      <p className={styles.subtitle}>The 12 editorial skills that guide agent behaviour.</p>

      <div className={styles.skillsLayout}>
        <div className={styles.skillList}>
          {skills.map(s => (
            <div
              key={s.name}
              className={`${styles.skillItem} ${selected?.name === s.name ? styles.skillItemActive : ''}`}
              onClick={() => setSelected(s)}
            >
              <div className={styles.skillItemName}>{s.name}</div>
              <div className={styles.skillItemDesc}>{s.description}</div>
            </div>
          ))}
        </div>
        <div className={styles.skillDetail}>
          {selected ? (
            <pre className={styles.skillContent}>{selected.content}</pre>
          ) : (
            <p className={styles.empty}>Select a skill to view its content.</p>
          )}
        </div>
      </div>
    </div>
  );
}
