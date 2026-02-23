import { getDatabase } from "@/db";
import { useEffect, useState } from "react";

export const useProducts = () => {
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    let sub: any;

    const load = async () => {
      const db = await getDatabase();

      sub = db.products.find().$.subscribe((docs: any[]) => {
        setProducts(docs.map((d) => d.toJSON()));
      });
    };

    load();

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, []);

  return products;
};
