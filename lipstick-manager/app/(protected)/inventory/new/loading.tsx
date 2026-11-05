import styles from "./loading.module.css";

export default function NewInventoryLoading() {
  return (
    <main className={styles.shell} aria-busy="true" aria-label="正在载入录入页">
      <div className={styles.back} />
      <div className={styles.title} />
      <p>正在载入草稿…</p>
      <div className={styles.card} />
      <div className={styles.card} />
    </main>
  );
}
