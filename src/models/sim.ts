import { Action, Condition, MTGCard, MTGScript } from "./classes";

const MAX_TURNS = 50

class MTGSim {
    script: MTGScript;
    game:MTGGame;
    
    constructor(script:MTGScript) {
        this.script = script;
        let deck:MTGCard[] = []
        this.game = new MTGGame(deck);
    }

    public run(times:number) {
        for (let i = 0; i < times; i++) {
            this.simulate();
        }
    }

    private simulate() {
        this.game.onMainOne = this.scriptOnMainOne;
        //We run the script while we are under the max turn limit
        this.game.start();
        while (this.game.turn < MAX_TURNS) {
            this.game.playTurn();
        }
    }

    private scriptOnMainOne() {
        this.script.on?.mainOne?.forEach(phase => {
            if (phase.if) {
                if (this.checkConditions(phase.if)) {
                    this.doActions(phase.do);
                }
            } else {
                this.doActions(phase.do);
            }
        })
    }

    private doActions(actions: Action[]) {
        actions.forEach(this.doAction)
    }

    private doAction(action:Action) {
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
    }
    
    private checkConditions(conditions: Condition[]):boolean {
        return conditions.every(this.checkCondition)
    }

    private checkCondition(condition: Condition):boolean {
        if(condition.count) {
            if(condition.battlefield) return this.game.battlefield.filter(c => c.name === condition.battlefield).length >= condition.count;
            if(condition.graveyard) return this.game.graveyard.filter(c => c.name === condition.graveyard).length >= condition.count;
            if(condition.hand) return this.game.hand.filter(c => c.name === condition.hand).length >= condition.count;
            if(condition.exile) return this.game.exile.filter(c => c.name === condition.exile).length >= condition.count;
            if(condition.untapped) return this.game.battlefield.filter(c => c.name === condition.untapped && !c.tapped).length >= condition.count;
        } else {
            if(condition.battlefield) return this.game.battlefield.some(card => card.name === condition.battlefield)
            if(condition.graveyard) return this.game.graveyard.some(card => card.name === condition.graveyard)
            if(condition.hand) return this.game.hand.some(card => card.name === condition.hand)
            if(condition.exile) return this.game.exile.some(card => card.name === condition.exile)
            if(condition.lands) return this.game.lands.length >= condition.lands
            if(condition.untapped) return this.game.battlefield.some(card => card.name === condition.untapped && !card.tapped)
        }
        return false;
    }
}

class MTGGame {
    private _deck:MTGCard[];
    private _library:MTGCard[] = [];
    private _battlefield:MTGCard[] = [];
    private _graveyard:MTGCard[] = [];
    private _hand:MTGCard[] = [];
    private _exile:MTGCard[] = [];
    private _lands:MTGCard[] = [];
    private _turn:number = 0;

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

    public start() {
        this._turn = 0;
        this._library = this._deck; //TODO: Copy the cards in the deck and shuffle them into the library
        this._battlefield = []
        this._graveyard = []
        this._exile = []
        this._hand = []
        this._lands = []
        this.initialDraw();
    }

    public onDraw?:(card:MTGCard) => void;
    public onMainOne?:() => void;
    public onCombat?:() => void;
    public onMainTwo?:() => void;
    public onEndStep?:() => void;

    public onCast?:(card:MTGCard) => void;
    public onETB?:(card:MTGCard) => void;

    public playTurn() {
        //Untap step
        this._turn++;
        this._battlefield.forEach(card => {card.tapped = false});
        //TODO: call events
        //Upkeep step
        //TODO: call events
        //Draw step
        if(this._turn > 1) this.draw(1);
        //Main 1
        //Automatically play any one land from hand to battlefield
        this.playLand("Land")
        if(this.onMainOne) this.onMainOne();
        //Combat
        if(this.onCombat) this.onCombat();
        //Main 2
        if(this.onMainTwo) this.onMainTwo();
        //End step
        if(this.onEndStep) this.onEndStep();
    }

    private initialDraw() {
        let cards = this._library.splice(-7);
        this._hand = cards;
    }

    private findCard(identifier:string, cards:MTGCard[]):MTGCard|undefined {
        //If identifier has X > Y > Z
        //We search for X first, then Y, then Z
        let possibilities = identifier.split('>');
        possibilities.forEach(possibility => {
            let nameMatch = cards.find(card => card.name === possibility);
            if(nameMatch) return nameMatch
            let typeMatch = cards.find(card => card.types.includes(possibility));
            if(typeMatch) return typeMatch
        })
        return undefined;   
    }

    exileFromYard(card: string) {
        throw new Error("Method not implemented.");
    }
    flashback(card: string) {
        throw new Error("Method not implemented.");
    }
    cast(card: string) {
        if(this.onCast) this.onCast(this.findCard(card, this._hand)!);
        //We remove the card from the hand using findCard to match
        let mtgCard = this.findCard(card, this._hand);
        if(mtgCard) {
            this._hand = this._hand.filter(c => c !== mtgCard);
            //If the card is a permanent, we add it to the battlefield and trigger ETB
            if(mtgCard.isPermanent) {
                this._battlefield.push(mtgCard);
                if(this.onETB) this.onETB(mtgCard);
            }
            //If the card is not a permanent, we send it to the graveyard    
            else {
                this._graveyard.push(mtgCard);
            }
        }
    }
    playLand(identifier:string) {
        let land = this.findCard(identifier, this._hand);
        if(land) {
            this._lands.push(land);
            this._hand = this._hand.filter(c => c !== land);
        }
    }
    tapLand(howMany: number) {
        //We grab howMany untapped lands
        let lands = this._battlefield.filter(card => card.isLand && !card.tapped).slice(0, howMany);
        //And tap them all
        lands.forEach(land => land.tapped = true);
    }
    reanimate(identifier: string) {
        //We find the card in the graveyard using findCard
        let card = this.findCard(identifier, this._graveyard);
        if(card) {
            //We remove it from the graveyard
            this._graveyard = this._graveyard.filter(c => c !== card);
            //And add it to the battlefield
            this._battlefield.push(card);
            //And trigger ETB
            if(this.onETB) this.onETB(card);
        }
    }
    discard(identifier: string) {
        //We find the card in the hand using findCard
        let mtgCard = this.findCard(identifier, this._hand);
        if(mtgCard) {
            //We remove it from the hand
            this._hand = this._hand.filter(c => c !== mtgCard);
            //And add it to the graveyard
            this._graveyard.push(mtgCard);
        }        
    }
    tutorCard(identifier: string) {
        //We find the card in the library using findCard
        let mtgCard = this.findCard(identifier, this._library);
        if(mtgCard) {
            //We remove it from the library
            this._library = this._library.filter(c => c !== mtgCard);
            //And add it to the hand
            this._hand.push(mtgCard);
        }
    }
    draw(howMany: number) {
        let cards = this._library.splice(howMany * -1);
        cards.forEach(card => {
            this._hand.push(card);
            if(this.onDraw) this.onDraw(card)
        })
    }
    mill(howMany: number) {
        let cards = this._library.splice(howMany * -1);
        cards.forEach(card => {
            this._graveyard.push(card);
        })
    }
}

export default MTGSim


