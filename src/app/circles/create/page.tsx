import type { Metadata } from "next";
import { CreateCircleForm } from "@/components/circle/CreateCircleForm";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Create a Circle" };

export default function CreateCirclePage() {
  return (
    <div className={styles.page}>
      <div className={`container container--sm ${styles.inner}`}>
        <CreateCircleForm />
      </div>
    </div>
  );
}
