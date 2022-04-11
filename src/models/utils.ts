import { MTGCard } from "./types";
import * as ls from "local-storage";

export const MAX_TURNS = 50

export const ARENA_EXPORT_REGEX = /(\d+) ([^(]+) \(([\S]{3})\) ([\d]+)/;

export function storeCardData(set:string, collectorNumber:string, card:MTGCard) {
    const cardKey = `MTGSIM_${set}_${collectorNumber}`.toUpperCase()
    ls.set<MTGCard>(cardKey, card)
}

export function loadCardData(set:string, collectorNumber:string) {
    const cardKey = `MTGSIM_${set}_${collectorNumber}`.toUpperCase()
    return ls.get<MTGCard>(cardKey)
}

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