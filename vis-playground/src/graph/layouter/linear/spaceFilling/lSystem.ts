import { Point, Vector } from '2d-geometry';
import * as d3 from 'd3'
import { deg2rad } from 'src/graph/graphical/primitives/util';

export class LSystem {
    static MAX_ORDER = 7;

    variables: string[]
    constants: string[]
    axiom: string
    rules: Record<string, string>
    
    moveRules: Record<string, (LSystemState: LSystemState) => void>

    constructor(
        {
            variables,
            constants,
            axiom,
            rules,
            moveRules
        }: {
            variables: string[],
            constants: string[],
            axiom: string,
            rules: Record<string, string>,
            moveRules: Record<string, (LSystemState: LSystemState) => void>
        }) {
        this.variables = variables
        this.constants = constants
        this.axiom = axiom
        this.rules = rules
        this.moveRules = moveRules
    }

    generateString(order: number) {
        let currentString = this.axiom
        for (let i = 0; i < order; i++) {
            let newString = ''
            for (const char of currentString) {
                if (this.variables.includes(char)) {
                    newString += this.rules[char]
                } else if (this.constants.includes(char)) {
                    newString += char
                }
            }
            currentString = newString
        }
        return currentString
    }

    getOrderForMinPoints(minPoints: number) {
        const checkIfRuleStoresPoint = (char: string) => {
            const lSystem = new LSystemState(this);
            lSystem.move(char);
            return lSystem.points.length > 0;
        }

        let order = 0;
        for (let i = 0; i < LSystem.MAX_ORDER; i++) {
            const string = this.generateString(i);
            // Count how many points are stored in the string
            const points = string.split('').filter(checkIfRuleStoresPoint).length;
            if (points >= minPoints) {
                order = i;
                break;
            }
        }
        return order;
    }



    static get(type: string): LSystem {
        type = type.toLowerCase();
        switch (type) {
            case 'hilbert':
                return lHilbert;
            case 'sierpinski curve':
                return lSierpinskiCurve;
            case 'gosper':
                return lGosper;
            case 'moore':
                return lMoore;
            case 'peano':
                return lPeano;
            case 'sierpinski arrowhead':
                return lSierpinskiArrowhead;
            
            default:
                throw new Error(`Unknown curve type ${type}`);
        }
    }
}




export class LSystemState {

    currentPosition: Point
    currentDirection: Vector

    
    points: Point[] = []    

    constructor(
        public lSystem: LSystem,
        startPosition: Point = new Point(0, 0),
        startDirection: Vector = new Vector(1, 0)
    ) {
        this.currentPosition = startPosition
        this.currentDirection = startDirection
    }

    private addCurrentPositionToPoints() {
        this.points.push(this.currentPosition)
    }

    execute(order: number) {
        this.points = [this.currentPosition]
        const string = this.lSystem.generateString(order)

        // console.log(order, string)
        for (const char of string) {
            this.move(char)
        }
    }

    move(char: string) {
        if (this.lSystem.moveRules[char]) {
            this.lSystem.moveRules[char](this)
        }
    }

    goForward(length: number) {
        this.currentPosition = this.currentPosition.translate(this.currentDirection.multiply(length))
        this.addCurrentPositionToPoints()
    }

    turnDegrees(degrees: number) {
        this.currentDirection = this.currentDirection.rotate(-deg2rad(degrees))

    }
}


export class SpaceFillingCurve {
    static readonly MAX_ORDER = 7;

    public readonly order: number;
    
    lSystem: LSystem;
    lState: LSystemState;

    public points: Point[] = [];

    public xExtent: [number, number] = [0, 0];
    public yExtent: [number, number] = [0, 0];

    constructor(lSystem: LSystem, order: number) {
        this.order = order;
        this.lSystem = lSystem;

        this.lState = new LSystemState(lSystem);
        this.lState.execute(order)
        this.points = this.lState.points;

        this.xExtent = d3.extent(this.points, d => d.x) as [number, number];
        this.yExtent = d3.extent(this.points, d => d.y) as [number, number];
    }

    get totalPointCount(): number {
        return this.points.length;
    }
    getPointAtUnitInterval(t: number, 
        xTransformer: (x: number) => number = x => x,
        yTransformer: (y: number) => number = y => y
    ): Point {
        if (t < 0 || t > 1) {
            throw new Error("t must be in [0, 1]");
        }

        const totalPoints = this.totalPointCount;
        
        const indexLow = Math.floor(t * totalPoints);
        const indexHigh = Math.ceil(t * totalPoints);



        const part = t * totalPoints - indexLow;

        // console.log("P:", t, indexLow, indexHigh, part, totalPoints)

        const pointLow = this.getPointAtIndex(indexLow);
        const pointHigh = this.getPointAtIndex(indexHigh);

        const x = xTransformer(pointLow.x + part * (pointHigh.x - pointLow.x));
        const y = yTransformer(pointLow.y + part * (pointHigh.y - pointLow.y));

        return new Point(x, y);
    }

    getPointAtIndex(index: number, clamp = true): Point {
        if (clamp) {
            index = Math.max(0, Math.min(this.points.length - 1, index));
        }
        if (index < 0 || index >= this.points.length) {
            throw new Error(`Index out of bounds: ${index} / ${this.points.length}`);
        }

        return this.points[index];
    }

    

}


const lHilbert = new LSystem({
    variables: ['X', 'Y'],
    constants: ['F', '+', '-'],
    axiom: 'X',
    rules: {
        'X': '+YF-XFX-FY+',
        'Y': '-XF+YFY+FX-'
    },
    moveRules: {
        'F': (state: LSystemState) => state.goForward(1),
        '+': (state: LSystemState) => state.turnDegrees(90),
        '-': (state: LSystemState) => state.turnDegrees(-90),

    }
})

const lPeano = new LSystem({
    variables: ['X', 'Y'],
    constants: ['F', '+', '-'],
    axiom: 'X',
    rules: {
        'X': 'XFYFX-F-YFXFY+F+XFYFX',
        'Y': 'YFXFY+F+XFYFX-F-YFXFY'
    },
    moveRules: {
        'F': (state: LSystemState) => state.goForward(1),
        '+': (state: LSystemState) => state.turnDegrees(90),
        '-': (state: LSystemState) => state.turnDegrees(-90),

    }
})

const lMoore = new LSystem({
    variables: ['L', 'R'],
    constants: ['F', '+', '-'],
    axiom: 'LFL+F+LFL',
    rules: {
        'L': '-RF+LFL+FR-',
        'R': '+LF-RFR-FL+'
    },
    moveRules: {
        'F': (state: LSystemState) => state.goForward(1),
        '+': (state: LSystemState) => state.turnDegrees(90),
        '-': (state: LSystemState) => state.turnDegrees(-90),
    }
})


const lGosper = new LSystem({
    variables: ['G', 'F'],
    constants: ['+', '-'],
    axiom: 'F',
    rules: {
        'F': 'F-G--G+F++FF+G-',
        'G': '+F-GG--G-F++F+G'
    },
    moveRules: {
        'F': (state: LSystemState) => state.goForward(1),
        'G': (state: LSystemState) => state.goForward(1),
        '+': (state: LSystemState) => state.turnDegrees(60),
        '-': (state: LSystemState) => state.turnDegrees(-60),

    }
})

const lSierpinskiCurve = new LSystem({
    variables: ['X'],
    constants: ['F', '+', '-'],
    axiom: 'F--XF--F--XF',
    rules: {
        'X': 'XF+F+XF--F--XF+F+X',
    },
    moveRules: {
        'F': (state: LSystemState) => state.goForward(1),
        '+': (state: LSystemState) => state.turnDegrees(45),
        '-': (state: LSystemState) => state.turnDegrees(-45),

    }
})

const lSierpinskiArrowhead = new LSystem({
    variables: ['F', 'G'],
    constants: ['+', '-'],
    axiom: 'F',
    rules: {
        'F': 'G-F-G',
        'G': 'F+G+F'
    },
    moveRules: {
        'F': (state: LSystemState) => state.goForward(1),
        '+': (state: LSystemState) => state.turnDegrees(60),
        '-': (state: LSystemState) => state.turnDegrees(-60),

    }
})


// "Hilbert",
// "Peano",
// "Gosper",
// "Moore",
// "Sierpinski Arrowhead",
// "Sierpinski Curve",