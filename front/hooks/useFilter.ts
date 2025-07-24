import { useMemo } from "react";

type FilterConfig<T> = {
  [key: string]: {
    value: any;
    predicate: (item: T, filterValue: any) => boolean;
  };
};

export function useFilter<T>(data: T[], filters: FilterConfig<T>): T[] {
  return useMemo(() => {
    return data.filter((item) => {
      return Object.values(filters).every(({ value, predicate }) => {
        if (value === undefined || value === null || value === "") return true;
        return predicate(item, value);
      });
    });
  }, [data, filters]);
}
