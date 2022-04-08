export type MTGCard = {
    name: string;
    types: string[];
    tapped: boolean;
    isPermanent: boolean;
    isLand: boolean;
}

export type MTGScript = {
    deck: string, //Arena format export
    on: {
        etb?: CardAction[],
        cast?: CardAction[],
        mainOne?: PhaseAction[],
        combat?: PhaseAction[],
        mainTwo?: PhaseAction[],
        endStep?: PhaseAction[],
    }
}

export type CardAction = {
    card: string,
    if?: Condition[]
    do: Action[]
}

export type PhaseAction = {
    name: string,
    if?: Condition[],
    do: Action[]
}

export type Condition = {
    battlefield?: string, //YAML supports sending arrays, so we could receive an array of strings, may be worth changing the type to string | string[]
    graveyard?: string,
    hand?: string,
    exile?: string,
    lands?: number,
    turn?: number,
    untapped?: string,
    count?: number,
    exactly?: number,
}

export type Action = {
    mill?: number,
    draw?: number,
    tutor?: string,
    exile?: string,
    discard?: string,
    reanimate?: string,
    tapLand?: number,
    cast?: string,
    flashback?: string,
    tally?: string,
}