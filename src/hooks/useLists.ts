import { getDatabase } from "@/db";
import { useEffect, useState } from "react";

export const useLists = () => {
  const [lists, setLists] = useState<any[]>([]);

  useEffect(() => {
    let sub: any;

    const load = async () => {
      const db = await getDatabase();

      sub = db.lists
        .find({
          selector: { archived: false },
        })
        .$.subscribe((docs: any[]) => {
          setLists(docs.map((d) => d.toJSON()));
        });
    };

    load();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, []);

  return lists;
};
