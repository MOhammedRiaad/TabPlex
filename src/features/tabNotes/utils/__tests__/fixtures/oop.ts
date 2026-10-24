// Real model and quick-view style output for three open tabs about object-oriented programming (refs 1..3):
// two English pages (MDN and a tutorial) and one Portuguese article. Used by the second round of groupTopics tests.
// OOP_POINTS has no topic hints (what the no-AI quick view often gives); OOP_POINTS_TAGGED has AI-style hints.
import { KeyPoint, NoteSource } from '../../../types';

export const OOP_SOURCES: NoteSource[] = [
    {
        ref: 1,
        tabId: 201,
        windowId: 1,
        title: 'Object-oriented programming',
        url: 'https://developer.mozilla.example/Object-oriented_programming',
        mode: 'ai',
        truncated: false,
        notEnglish: false,
    },
    {
        ref: 2,
        tabId: 202,
        windowId: 1,
        title: 'Object Oriented Programming in JavaScript',
        url: 'https://tutorial.example/oop-in-javascript',
        mode: 'ai',
        truncated: false,
        notEnglish: false,
    },
    {
        ref: 3,
        tabId: 203,
        windowId: 2,
        title: 'Objetos e protótipos em JavaScript',
        url: 'https://medium.example/objetos-javascript',
        mode: 'ai',
        truncated: false,
        notEnglish: true,
    },
];

const TEXTS: [number, string][] = [
    // 1: MDN "Object-oriented programming"
    [
        1,
        'Object-oriented programming (OOP) models a system as a collection of objects, where each object represents an aspect of the system.',
    ],
    [
        1,
        'Classes define abstract definitions for types of objects, listing the data properties and methods that all objects of that type will have.',
    ],
    [
        1,
        "Instances of a class are concrete objects created using the constructor, initializing the object's internal state.",
    ],
    [
        1,
        'Inheritance allows creating new classes (subclasses) based on existing ones (superclasses), inheriting their properties and methods.',
    ],
    [
        1,
        'Encapsulation maintains the internal state of an object private, accessible only through its methods, providing a firewall between the object and external code.',
    ],
    [
        1,
        'JavaScript constructors provide a way to define object shapes, including their methods, in a single place, similar to class definitions in other OOP languages.',
    ],
    // 2: GeeksforGeeks "Object Oriented Programming in JavaScript"
    [2, 'A Class in JavaScript is a blueprint or template used to create objects.'],
    [2, 'An Object in JavaScript is an instance of a class that represents a real-world entity.'],
    [
        2,
        'Abstraction in JavaScript is the process of hiding implementation details and showing only the essential features of an object.',
    ],
    [
        2,
        'Encapsulation is the process of wrapping data and methods into a single unit and restricting direct access to the data.',
    ],
    [2, 'Inheritance allows one class to acquire properties and methods of another class using the extends keyword.'],
    [2, 'Polymorphism means a single entity can behave differently in different situations.'],
    // 3: Medium article in Portuguese
    [
        3,
        'Objetos em JavaScript são associações de pares valor-chave, e não precisam de uma estrutura definida antecipadamente.',
    ],
    [
        3,
        'A palavra-chave new cria objetos usando funções de construtor, imitando o comportamento de construtores em Java.',
    ],
    [
        3,
        'Protótipos são objetos que JavaScript usa para herdar propriedades e métodos, permitindo a reutilização de código.',
    ],
    [
        3,
        'Classes introduzidas no ES6 são açúcar sintático sobre o modelo de herança baseada em protótipos de JavaScript.',
    ],
    [
        3,
        'call é uma função embutida que permite vincular objetos a métodos, alterar o valor de this dentro de uma função.',
    ],
    [3, 'Getters e Setters permitem o uso de funções para manipular métodos de acesso à propriedade em classes.'],
];

/** AI-style topic hints, one per text above, in the same order */
const HINTS = [
    'OOP',
    'Classes',
    'Instances',
    'Inheritance',
    'Encapsulation',
    'Constructors',
    'Classes',
    'Objects',
    'Abstraction',
    'Encapsulation',
    'Inheritance',
    'Polymorphism',
    'Objetos',
    'Construtores',
    'Protótipos',
    'Classes',
    'this',
    'Getters e Setters',
];

/** Points numbered per source, as the extractors do ("p2-5": source 2, point 5) */
function build(hints: boolean): KeyPoint[] {
    const counters = new Map<number, number>();
    return TEXTS.map(([sourceRef, text], i) => {
        const n = (counters.get(sourceRef) ?? 0) + 1;
        counters.set(sourceRef, n);
        return { id: `p${sourceRef}-${n}`, sourceRef, text, topicHint: hints ? HINTS[i] : '' };
    });
}

export const OOP_POINTS: KeyPoint[] = build(false);
export const OOP_POINTS_TAGGED: KeyPoint[] = build(true);
