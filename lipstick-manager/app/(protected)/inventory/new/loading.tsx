import styles from "./loading.module.css";

export default function NewInventoryLoading() {
  return (
    <main className={styles.shell} aria-busy="true" aria-label="正在载入录入页">
      <div className={styles.back} />
      <div className={styles.title} />
      <div className={styles.card} />
      <div className={styles.card} />
    </main>
  );
}
