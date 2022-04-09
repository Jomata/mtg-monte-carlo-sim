import { Action, CardAction, Condition, MTGCard, MTGScript, PhaseAction } from "./classes";
import * as ls from "local-storage";

const MAX_TURNS = 50

class SimTally {
    name: string;
    turns: number[];

    public get averageTurn() {
        return this.turns.reduce((a, b) => a + b, 0) / this.turns.length;
    }

    constructor(name: string, turn?:number) {
        this.name = name;
        this.turns = turn ? [turn] : [];
    }
}

export const ARENA_EXPORT_REGEX = /(\d+) ([^(]+) \(([\S]{3})\) ([\d]+)/;

export function storeCardData(set:string, collectorNumber:string, card:MTGCard) {
    const cardKey = `MTGSIM_${set}_${collectorNumber}`.toUpperCase()
    ls.set<MTGCard>(cardKey, card)
}

export function loadCardData(set:string, collectorNumber:string) {
    const cardKey = `MTGSIM_${set}_${collectorNumber}`.toUpperCase()
    return ls.get<MTGCard>(cardKey)
}

class MTGSim {
    script: MTGScript;
    game: MTGGame;
    results:SimTally[] = [];
    private gameStopFlag:boolean  = false;
    
    constructor(script:MTGScript) {
        this.script = script;
        let deck:MTGCard[] = this.parseDeck(script.deck);
        console.log('Deck',deck);
        this.game = new MTGGame(deck);
    }

    public run(times:number):SimTally[] {
        this.results = []
        for (let i = 0; i < times; i++) {
            this.simulate();
        }
        console.log('Results',this.results)
        return this.results;
    }

    private parseDeck(deck:string):MTGCard[] {
        const regex = ARENA_EXPORT_REGEX

        return deck.split("\r").flatMap(line => line.split("\n")).flatMap(line => {
            let match = regex.exec(line);
            if(match) {
                let [, count, cardName, setName, setNumber] = match
                return Array(parseInt(count)).fill(true).map(() => {return loadCardData(setName, setNumber)})
            } else  return []
        })
    }

    private simulate() {
        this.game.onMainOne = this.runPhaseActions.bind(this, this.script.on?.mainOne);
        this.game.onCombat = this.runPhaseActions.bind(this, this.script.on?.combat);
        this.game.onMainTwo = this.runPhaseActions.bind(this, this.script.on?.mainTwo);
        this.game.onEndStep = this.runPhaseActions.bind(this, this.script.on?.endStep);

        this.game.onCast = this.runCardActions.bind(this, this.script.on?.cast || []);
        this.game.onETB = this.runCardActions.bind(this, this.script.on?.etb || []);
        this.game.onMulligan = this.mulliganLogic.bind(this);
        //We run the script while we are under the max turn limit
        this.gameStopFlag = false;
        this.game.start();
        while (this.game.turn < MAX_TURNS && !this.gameStopFlag) {
            this.game.playTurn();
        }
    }

    private mulliganLogic(cards:MTGCard[], mulliganCount:number): [MTGCard[] | undefined, MTGCard[]] {
        if(this.script.mulligan) {
            //console.log("Checking for mulligan", cards.map(c => c.name))
            let result = this.checkConditions(this.script.mulligan.until);
            if(result) {
                let bottom:MTGCard[] = []
                while(bottom.length < mulliganCount) {
                    //Find a card that matches bottom, or a random one if no match
                    let card = MTGGame.findCard(this.script.mulligan.bottom, cards) || cards[0];
                    //Remove from cards
                    cards = cards.filter(c => c !== card)
                    //Insert it into the bottom array
                    bottom.push(card)
                }
                return [cards, bottom]
            } else {
                return [undefined, cards]
            }
        }
        else {
            return [cards, []]
        }
    }

    private runPhaseActions(actions?:PhaseAction[]) {
        actions?.forEach(phase => {
            //console.debug("--- Evaluating Phase Action ---", phase.name)
            if (phase.if) {
                //console.debug(" > Conditions:", phase.if)
                if (this.checkConditions(phase.if)) {
                    //console.debug(" > Conditions met, running actions")
                    this.doActions(phase.do);
                } else if(phase.else) {
                    //console.debug(" > Conditions not met, running else actions")
                    this.doActions(phase.else);
                } else {
                    //console.debug(" > Conditions not met, no else actions")
                }
            } else {
                //console.debug(" > No conditions, running actions")
                this.doActions(phase.do);
            }
        })
    }

    private runCardActions(actions:CardAction[], card:MTGCard) {
        //TODO: Use MTG.findCard to check if the card matches the identifier
        actions?.filter(a => MTGGame.isMatch(a.card, card)).forEach(action => {
            if (action.if) {
                if (this.checkConditions(action.if)) {
                    this.doActions(action.do);
                } else if (action.else) {
                    this.doActions(action.else);
                } else {
                    //console.debug(" > Conditions not met, no else actions")
                }
            } else {
                this.doActions(action.do);
            }
        })
    }

    private doActions(actions: Action[]) {
        actions.forEach(this.doAction.bind(this))
    }

    private doAction(action:Action) {
        if(this.gameStopFlag) return;

        if(action.mill) {
            this.game.mill(action.mill);
        }
        if(action.draw) {
            this.game.draw(action.draw);
        }
        if(action.tutor) {
            this.game.tutorCard(action.tutor);
        }
        if(action.exile) {
            this.game.exileFromYard(action.exile);
        }
        if(action.discard) {
            this.game.discard(action.discard);
        }
        if(action.reanimate) {
            this.game.reanimate(action.reanimate);
        }
        if(action.tapLand) {
            this.game.tapLand(action.tapLand);
        }
        if(action.cast) {
            this.game.cast(action.cast);
        }
        if(action.flashback) {
            this.game.flashback(action.flashback);
        }
        if(action.tally) {
            //If we have a tally, we need to add the turn to the tally
            //If we don't, we push a new tally with the current turn
            this.results.find(r => r.name === action.tally)?.turns.push(this.game.turn) || this.results.push(new SimTally(action.tally, this.game.turn));
            this.gameStopFlag = true;
            console.log("ITERATION END", action.tally?.toUpperCase())
        }
    }
    
    private checkConditions(conditions: Condition[]):boolean {
        //return conditions.every(this.checkCondition.bind(this))
        let results = conditions.map(this.checkCondition.bind(this))
        return results.every(result => result === true)
    }

    private checkCondition(condition: Condition):boolean {
        if(condition.exactly !== undefined) {
            if(condition.battlefield) return MTGGame.findManyCards(condition.battlefield, this.game.battlefield).length === condition.exactly;
            if(condition.graveyard) return MTGGame.findManyCards(condition.graveyard, this.game.graveyard).length === condition.exactly;
            if(condition.hand) return MTGGame.findManyCards(condition.hand, this.game.hand).length === condition.exactly;
            if(condition.exile) return MTGGame.findManyCards(condition.exile, this.game.exile).length === condition.exactly;
            if(condition.untapped) return MTGGame.findManyCards(condition.untapped, this.game.battlefield).filter(card => !card.tapped).length === condition.exactly;
        } else if(condition.count !== undefined) {
            if(condition.battlefield) return MTGGame.findManyCards(condition.battlefield, this.game.battlefield).length >= condition.count;
            if(condition.graveyard) return MTGGame.findManyCards(condition.graveyard, this.game.graveyard).length >= condition.count;
            if(condition.hand) return MTGGame.findManyCards(condition.hand, this.game.hand).length >= condition.count;
            if(condition.exile) return MTGGame.findManyCards(condition.exile, this.game.exile).length >= condition.count;
            if(condition.untapped) return MTGGame.findManyCards(condition.untapped, this.game.battlefield).filter(card => !card.tapped).length >= condition.count;
        } else {
            if(condition.battlefield) return MTGGame.findCard(condition.battlefield, this.game.battlefield) !== undefined;
            if(condition.graveyard) return MTGGame.findCard(condition.graveyard, this.game.graveyard) !== undefined;
            if(condition.hand) return MTGGame.findCard(condition.hand, this.game.hand) !== undefined;
            if(condition.exile) return MTGGame.findCard(condition.exile, this.game.exile) !== undefined;    
            if(condition.untapped) return MTGGame.findManyCards(condition.untapped, this.game.battlefield).some(card => !card.tapped)
            if(condition.lands) return this.game.lands.filter(c => !c.tapped).length >= condition.lands;
            if(condition.turn) return this.game.turn === condition.turn;
        }
        return false;
    }
}

//TODO: Big fix: Script should be able to handle multiple cards with the same name
//Right now if I remove a single card named X, it will remove all cards named X
class MTGGame {
    private _deck:MTGCard[];
    private _library:MTGCard[] = [];
    private _battlefield:MTGCard[] = [];
    private _graveyard:MTGCard[] = [];
    private _hand:MTGCard[] = [];
    private _exile:MTGCard[] = [];
    private _lands:MTGCard[] = [];
    private _turn:number = 0;
    private _endFlag = false;

    public get turn():number { return this._turn; }
    public get battlefield():readonly MTGCard[] { return this._battlefield; }
    public get graveyard():readonly MTGCard[] { return this._graveyard; }
    public get exile():readonly MTGCard[] { return this._exile; }
    public get lands():readonly MTGCard[] { return this._lands; }
    public get library():readonly MTGCard[] { return this._library; }
    public get hand():readonly MTGCard[] { return this._hand; }

    constructor (deck:MTGCard[]) {
        this._deck = deck;
    }

    private log(...args: any[]) {
        console.debug(`T${this.turn}`, ...args)
    }

    public start() {
        this._endFlag = false;
        this._turn = 0;
        this._library = []
        this._battlefield = []
        this._graveyard = []
        this._exile = []
        this._hand = []
        this._lands = []
        this.log("Starting game")
        this.initialDraw();
        this.log("Hand", this.hand.map(c => c.name))

    }
    
    public end() {
        //Set a flag to stop processing events
        this._endFlag = true;
    }

    public onDraw?:(card:MTGCard) => void;
    public onMainOne?:() => void;
    public onCombat?:() => void;
    public onMainTwo?:() => void;
    public onEndStep?:() => void;

    public onCast?:(card:MTGCard) => void;
    public onETB?:(card:MTGCard) => void;
    public onMulligan?:(cards: MTGCard[], mulliganCount: number) => [hand:MTGCard[] | undefined, bottom:MTGCard[]]

    public playTurn() {
        const deckSize = this._deck.length;
        //If the sum of all cards in play does not match the deck size, we have a problem
        if(this._hand.length + this._battlefield.length + this._exile.length + this._graveyard.length + this._lands.length + this._library.length !== deckSize) {
            console.error('Hand',this.hand)
            console.error('Battlefield',this.battlefield)
            console.error('Exile',this.exile)
            console.error('Graveyard',this.graveyard)
            console.error('Lands',this.lands)
            console.error('Library',this.library.length)
            throw new Error("Deck size does not match cards in game")
        }

        if(this._endFlag) return;
        //Untap step
        this._turn++;
        //this.log(`Turn ${this._turn} start`);
        this._battlefield.forEach(card => {card.tapped = false});
        this._lands.forEach(card => {card.tapped = false});
        //TODO: call events
        //Upkeep step
        //TODO: call events
        //Draw step
        if(this._endFlag) return;
        if(this._turn > 1) this.draw(1);
        //Main 1
        //Automatically play any one land from hand to battlefield
        if(this._endFlag) return;
        this.playLand("Land")

        //this.log("[Hand]", this.hand.map(c => c.name).join(" | "))
        //this.log("[Land]", this.lands.map(c => c.name).join(" | "))
        //this.log("[Yard]", this.graveyard.map(c => c.name).join(" | "))

        if(this._endFlag) return;
        if(this.onMainOne) this.onMainOne();
        //Combat
        if(this._endFlag) return;
        if(this.onCombat) this.onCombat();
        //Main 2
        if(this._endFlag) return;
        if(this.onMainTwo) this.onMainTwo();
        //End step
        if(this._endFlag) return;
        if(this.onEndStep) this.onEndStep();

        if(this.lands.every(c => !c.tapped)) {
            console.warn("Ended turn doing nothing", this.hand.map(c => c.name))
        }
    }

    private initialDraw() {
        this._library = this._deck.map(c => c).sort(() => Math.random() - 0.5);
        let cards = this._library.splice(-7);
        //TODO: Check no more than 6 mulligans
        if(this.onMulligan) {
            let mulliganCount = 0
            let hand:MTGCard[] | undefined = []
            let bottom:MTGCard[] = []
            do {
                if(mulliganCount > 6) {
                    hand = []
                    bottom = cards
                } else {
                    this._hand = cards; //Need to assign to hand for condition checking
                    [hand, bottom] = this.onMulligan(cards,mulliganCount);
                    if(hand === undefined) {
                        mulliganCount++;
                        this.log(`Mulligan to ${7 - mulliganCount}`, cards.map(c => c.name).join(" | "))
                        this._library = this._deck.map(c => c).sort(() => Math.random() - 0.5);
                        cards = this._library.splice(-7);
                    }
                }
            } while(hand === undefined)
            //Keep on mulliganing while hand returns undefined, need to pass to onMulligan how many mulligans we're into
            this._hand = hand;
            //this.log("Starting Hand", this.hand.map(c => c.name).join(" | "))
            //this.log("Bottoming", bottom.map(c => c.name).join(" | "))
            if(hand.length + bottom.length !== 7) {
                //throw new Error("Too many cards in mulligan")
                console.error("Too many cards in mulligan")
                console.error("Mulligan count", mulliganCount)
                console.error("Hand", hand.map(c => c.name))
                console.error("Bottom", bottom.map(c => c.name))
                throw new Error("Too many cards in mulligan")
            }
            if(bottom.length > 0) {
                //Add bottom to the start of the library
                this.log("Keeping", hand.map(c => c.name).join(" | "))
                this.log("Bottoming", bottom.map(c => c.name).join(" | "))
                this._library = bottom.concat(this._library);
            }
        } else {
            this._hand = cards;
        }
    }

    public static isMatch(identifier:string, card:MTGCard) : boolean {
        identifier = identifier.trim().toLowerCase();
        if(identifier === "any") return true;
        if(identifier === card.name.toLowerCase()) return true;
        if(card.types.map(t => t.toLowerCase()).includes(identifier)) return true;

        return false;
    }

    public static findCard(identifier:string, cards:readonly MTGCard[]):MTGCard|undefined {
        //If identifier has X > Y > Z
        //We search for X first, then Y, then Z
        let possibilities = identifier.toLowerCase().split('>');
        for (const i in possibilities) {
            let match = cards.find(c => MTGGame.isMatch(possibilities[i], c));
            if(match) return match
        }
        
        return undefined;   
    }

    public static findManyCards(identifier:string, cards:readonly MTGCard[]):MTGCard[] {
        //Need to fix this, should grab starting from the first identifier
        return cards.flatMap(card => {
            if(MTGGame.findCard(identifier, [card])) return [card]
            else return []
        })
    }

    exileFromYard(identifier: string) {
        let mtgCard = MTGGame.findCard(identifier, this._graveyard);
        if(mtgCard) {
            //(`Exiling` , mtgCard.name)
            this._graveyard = this._graveyard.filter(card => card !== mtgCard);
            this._exile.push(mtgCard);
        }
    }
    flashback(identifier: string) {
        //Cast card from graveyard
        let mtgCard = MTGGame.findCard(identifier, this._graveyard);
        if(mtgCard) {
            //this.log(`Flashing back`, mtgCard.name)
            //And then exile it
            this._graveyard = this._graveyard.filter(card => card !== mtgCard);
            if(this.onCast) this.onCast(mtgCard);
            this._exile.push(mtgCard);
        }
    }
    cast(identifier: string) {
        let mtgCard = MTGGame.findCard(identifier, this._hand);
        if(mtgCard) {
            this.log(`Casting`,mtgCard.name);
            this._hand = this._hand.filter(c => c !== mtgCard);
            if(this.onCast) this.onCast(mtgCard);
            //If the card is a permanent, we add it to the battlefield and trigger ETB
            if(mtgCard.isPermanent) {
                this._battlefield.push(mtgCard);
                //this.log(`${mtgCard.name} ETBs`);
                if(this.onETB) this.onETB(mtgCard);
            }
            //If the card is not a permanent, we send it to the graveyard    
            else {
                this._graveyard.push(mtgCard);
            }
        }
    }
    playLand(identifier:string) {
        let land = MTGGame.findCard(identifier, this._hand);
        if(land) {
            //this.log(`Playing land`,land.name);
            land.tapped = false;
            this._lands.push(land);
            this._hand = this._hand.filter(c => c !== land);
        }
    }
    tapLand(howMany: number) {
        //We grab howMany untapped lands
        let lands = this._lands.filter(card => !card.tapped).slice(0, howMany);
        //And tap them all
        //this.log(`Tapping ${lands.length} lands`);
        lands.forEach(land => land.tapped = true);
    }
    reanimate(identifier: string) {
        //We find the card in the graveyard using findCard
        let card = MTGGame.findCard(identifier, this._graveyard);
        if(card) {
            this.log(`Reanimating`, card.name);
            //We remove it from the graveyard
            this._graveyard = this._graveyard.filter(c => c !== card);
            //And add it to the battlefield
            this._battlefield.push(card);
            //And trigger ETB
            //this.log(`${card.name} ETBs`);
            if(this.onETB) this.onETB(card);
        }
    }
    discard(identifier: string) {
        //We find the card in the hand using findCard
        let mtgCard = MTGGame.findCard(identifier, this._hand);
        if(mtgCard) {
            this.log(`Discarding ${mtgCard.name}`);
            //We remove it from the hand
            this._hand = this._hand.filter(c => c !== mtgCard);
            //And add it to the graveyard
            this._graveyard.push(mtgCard);           
        }        
    }
    tutorCard(identifier: string) {
        //We find the card in the library using findCard
        let mtgCard = MTGGame.findCard(identifier, this._library);
        if(mtgCard) {
            //this.log(`Tutoring ${mtgCard.name}`);
            //We remove it from the library
            this._library = this._library.filter(c => c !== mtgCard);
            //And add it to the hand
            this._hand.push(mtgCard);
        }
    }
    draw(howMany: number) {
        let cards = this._library.splice(howMany * -1);
        cards.forEach(card => {
            this.log(`Drawing ${card.name}`);
            this._hand.push(card);
            if(this.onDraw) this.onDraw(card)
        })
    }
    mill(howMany: number) {
        let cards = this._library.splice(howMany * -1);
        //this.log(`Milling ${howMany} cards`, cards.map(c => c.name));
        cards.forEach(card => {
            this._graveyard.push(card);
        })
    }
}

export default MTGSim


