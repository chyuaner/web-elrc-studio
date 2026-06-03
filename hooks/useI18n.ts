import { AppI18n, I18nDict } from "@/lib/i18n";
import { useEffect, useState } from "react";

export function useI18n(): I18nDict {
  const [i18n, setI18n] = useState(AppI18n.get());

  useEffect(() => {
    const handleUpdate = () => setI18n({ ...AppI18n.get() });
    window.addEventListener("app-i18n-update", handleUpdate);
    return () => window.removeEventListener("app-i18n-update", handleUpdate);
  }, []);

  return i18n;
}
