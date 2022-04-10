export const countUniqueElements = <T>(arr: T[]):Map<T,number> => {
    const count: Map<T,number> = new Map();
    for (const element of arr) {
      if (count.has(element)) {
        count.set(element, count.get(element)! + 1);
      } else {
        count.set(element, 1);
      }
    }
    return count;
  }